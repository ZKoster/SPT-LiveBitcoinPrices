import { DependencyContainer } from "tsyringe";

import { IPostDBLoadModAsync } from "@spt-aki/models/external/IPostDBLoadModAsync";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";

import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor";
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor";
import { request } from "https";

class Mod implements IPostDBLoadModAsync {
    public async postDBLoadAsync(container: DependencyContainer): Promise<void> {
        const logger = container.resolve<ILogger>("WinstonLogger");
        const db = container.resolve<DatabaseServer>("DatabaseServer");

        const tables = db.getTables();
        const handbook = tables.templates.handbook;
        const therapist_coef = (100 - tables.traders["54cb57776803fa99248b456e"].base.loyaltyLevels[0].buy_price_coef) / 100;
        const bitcoin = handbook.Items.find(x => x.Id == "59faff1d86f7746c51718c9c");

        return this.getPrice().then((price) => {
            const inRub = price / therapist_coef;
            bitcoin.Price = inRub;
            logger.logWithColor(`Updated bitcoin to ${inRub}`, LogTextColor.MAGENTA, LogBackgroundColor.WHITE);
        });
    }

    private async getPrice(): Promise<number> {
        return new Promise((resolve, reject) => {
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
                            resolve(price);
                        } catch (e) {
                            console.error(e.message);
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
        })
    }
}

module.exports = { mod: new Mod() }