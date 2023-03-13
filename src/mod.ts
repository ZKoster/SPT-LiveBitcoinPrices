import { DependencyContainer } from "tsyringe";

import { IPostDBLoadModAsync } from "@spt-aki/models/external/IPostDBLoadModAsync";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";

import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor";
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor";
import { get } from "https";

class Mod implements IPostDBLoadModAsync {
    public async postDBLoadAsync(container: DependencyContainer): Promise<void> {
        const logger = container.resolve<ILogger>("WinstonLogger");
        const db = container.resolve<DatabaseServer>("DatabaseServer");

        const price = await this.getPrice();
        const tables = db.getTables();
        const handbook = tables.templates.handbook;
        const bitcoin = handbook.Items.find(x => x.Id == "59faff1d86f7746c51718c9c");
        const usd = handbook.Items.find(x => x.Id == "5696686a4bdc2da3298b456a");

        const inRub = price * usd.Price * 0.18;
        logger.logWithColor(`updating bitcoin to ${inRub}`, LogTextColor.MAGENTA, LogBackgroundColor.WHITE);
        bitcoin.Price = inRub;
    }

    private async getPrice(): Promise<number> {
        return new Promise((resolve, reject) => get(
            "https://api.blockchain.com/v3/exchange/tickers/BTC-USD",
            (res) => {
                res.setEncoding("utf8");
                let rawData = "";
                res.on("data", (chunk) => { rawData += chunk; });
                res.on("end", () => {
                    try {
                        const parsedData = JSON.parse(rawData);
                        const price = parseInt(parsedData["price_24h"], 10);
                        resolve(price);
                    } catch (e) {
                        console.error(e.message);
                    }
                });
            }));
    }
}

module.exports = { mod: new Mod() }