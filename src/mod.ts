import { DependencyContainer } from "tsyringe";

import { IPostDBLoadModAsync } from "@spt/models/external/IPostDBLoadModAsync";
import { DatabaseServer } from "@spt/servers/DatabaseServer";

import { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { LogBackgroundColor } from "@spt/models/spt/logging/LogBackgroundColor";
import { request } from "https";
import * as fs from "node:fs";
import * as path from "node:path";

class Mod implements IPostDBLoadModAsync {
    private static bitcoin: any
    private static logger: ILogger
    private static config: Config;
    private static therapist_coef: number;
    private static configPath = path.resolve(__dirname, "../config/config.json");
    private static pricePath = path.resolve(__dirname, "../config/price.json");

    public async postDBLoadAsync(container: DependencyContainer): Promise<void> {
        Mod.logger = container.resolve<ILogger>("WinstonLogger");
        Mod.config = JSON.parse(fs.readFileSync(Mod.configPath, "utf-8"));
        const db = container.resolve<DatabaseServer>("DatabaseServer");

        const tables = db.getTables();
        const handbook = tables.templates.handbook;
        Mod.therapist_coef = (100 - tables.traders["54cb57776803fa99248b456e"].base.loyaltyLevels[0].buy_price_coef) / 100;
        Mod.bitcoin = handbook.Items.find(x => x.Id == "59faff1d86f7746c51718c9c");

        // Update price on startup
        const currentTime = Math.floor(Date.now() / 1000);
        if (!await Mod.getPrice(currentTime > Mod.config.nextUpdate)) {
            return;
        }

        // Get new price every hour
        setInterval(Mod.getPrice, (60 * 60 * 1000));

        return;
    }

    static async getPrice(fetchPrices = true): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (!fetchPrices) {
                // Load last saved price
                const lastValue = JSON.parse(fs.readFileSync(Mod.pricePath, "utf-8"))[`${Mod.bitcoin.Id}`];
                if (lastValue === undefined) {
                    Mod.logger.logWithColor(`No last price saved, keeping bitcoin price at: ${Mod.bitcoin.Price}`, LogTextColor.MAGENTA, LogBackgroundColor.WHITE);
                } else {
                    Mod.bitcoin.Price = lastValue;
                    Mod.logger.logWithColor(`Updated bitcoin to ${Mod.bitcoin.Price} from price path`, LogTextColor.MAGENTA, LogBackgroundColor.WHITE);
                }
                resolve(true);
            } else {
                const req = request(
                    "https://api.tarkov.dev/graphql",
                    {
                        method: "POST"
                    },
                    (res) => {
                        res.setEncoding("utf8");
                        let rawData = "";
                        res.on("data", (chunk) => { rawData += chunk; });
                        res.on("end", () => {
                            try {
                                const parsedData = JSON.parse(rawData);
                                const price = parsedData.data.item.sellFor.find((x) => x.vendor.name === "Therapist").priceRUB
                                const inRub = price / Mod.therapist_coef;
                                Mod.bitcoin.Price = inRub;

                                // Store the prices to disk for next time
                                const jsonString: string = `{"${Mod.bitcoin.Id}": ${Mod.bitcoin.Price}}`
                                fs.writeFileSync(Mod.pricePath, JSON.stringify(JSON.parse(jsonString)));

                                // Update config file with the next update time
                                Mod.config.nextUpdate = Math.floor(Date.now() / 1000) + 3600;
                                fs.writeFileSync(Mod.configPath, JSON.stringify(Mod.config, null, 4));
                                Mod.logger.logWithColor(`Updated bitcoin to ${Mod.bitcoin.Price} from remote data`, LogTextColor.MAGENTA, LogBackgroundColor.WHITE);
                                resolve(true);
                            } catch (e) {
                                console.error(e.message);
                                resolve(false);
                            }
                        });
                    });

                req.on('error', (e) => {
                    console.error(e.message);
                    reject(e);
                })

                req.write(JSON.stringify({
                    query: `{
                    item(id: "59faff1d86f7746c51718c9c")
                    {
                      sellFor {
                        priceRUB
                        vendor {
                          name
                        }
                      }
                    }
                  }`
                }));
                req.end();
            }
        })
    }
}

interface Config {
    nextUpdate: number,
}

module.exports = { mod: new Mod() }
