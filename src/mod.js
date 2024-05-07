"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const LogTextColor_1 = require("/snapshot/project/obj/models/spt/logging/LogTextColor");
const LogBackgroundColor_1 = require("/snapshot/project/obj/models/spt/logging/LogBackgroundColor");
const https_1 = require("https");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
class Mod {
    static bitcoin;
    static logger;
    static therapist_coef;
    static config;
    static configPath = path.resolve(__dirname, "../config/config.json");
    static pricePath = path.resolve(__dirname, "../config/price.json");
    static originalPrice;
    async postDBLoadAsync(container) {
        Mod.logger = container.resolve("WinstonLogger");
        Mod.config = JSON.parse(fs.readFileSync(Mod.configPath, "utf-8"));
        const db = container.resolve("DatabaseServer");
        const tables = db.getTables();
        const handbook = tables.templates.handbook;
        Mod.therapist_coef = (100 - tables.traders["54cb57776803fa99248b456e"].base.loyaltyLevels[0].buy_price_coef) / 100;
        Mod.bitcoin = handbook.Items.find(x => x.Id == "59faff1d86f7746c51718c9c");
        Mod.originalPrice = Mod.bitcoin.Price;
        // Update price on startup
        const currentTime = Math.floor(Date.now() / 1000);
        if (!await Mod.getPrice(currentTime > Mod.config.nextUpdate)) {
            return;
        }
        // Get new price every hour
        setInterval(Mod.getPrice, (60 * 60 * 1000));
        return;
    }
    static async getPrice(fetchPrices = true) {
        return new Promise((resolve, reject) => {
            if (!fetchPrices) {
                // Load last saved price
                const lastValue = JSON.parse(fs.readFileSync(Mod.pricePath, "utf-8"))[`${Mod.bitcoin.Id}`];
                if (lastValue === undefined) {
                    Mod.logger.logWithColor(`No last price saved, keeping bitcoin price at: ${Mod.bitcoin.Price}`, LogTextColor_1.LogTextColor.MAGENTA, LogBackgroundColor_1.LogBackgroundColor.WHITE);
                }
                else {
                    Mod.bitcoin.Price = lastValue;
                    Mod.logger.logWithColor(`Updated bitcoin to ${Mod.bitcoin.Price} from price path`, LogTextColor_1.LogTextColor.MAGENTA, LogBackgroundColor_1.LogBackgroundColor.WHITE);
                }
                resolve(Mod.bitcoin.Price);
            }
            else {
                const req = (0, https_1.request)("https://api.tarkov.dev/graphql", {
                    method: "POST"
                }, (res) => {
                    res.setEncoding("utf8");
                    let rawData = "";
                    res.on("data", (chunk) => { rawData += chunk; });
                    res.on("end", () => {
                        try {
                            const parsedData = JSON.parse(rawData);
                            const price = parsedData.data.item.sellFor.find((x) => x.vendor.name === "Therapist").priceRUB;
                            const inRub = price / Mod.therapist_coef;
                            Mod.bitcoin.Price = inRub;
                            // Store the prices to disk for next time
                            const jsonString = `{"${Mod.bitcoin.Id}": ${Mod.bitcoin.Price}}`;
                            fs.writeFileSync(Mod.pricePath, JSON.stringify(JSON.parse(jsonString)));
                            // Update config file with the next update time
                            Mod.config.nextUpdate = Math.floor(Date.now() / 1000) + 3600;
                            fs.writeFileSync(Mod.configPath, JSON.stringify(Mod.config, null, 4));
                            Mod.logger.logWithColor(`Updated bitcoin to ${inRub} from remote data`, LogTextColor_1.LogTextColor.MAGENTA, LogBackgroundColor_1.LogBackgroundColor.WHITE);
                            resolve(price);
                        }
                        catch (e) {
                            console.error(e.message);
                        }
                    });
                });
                req.on('error', (e) => {
                    console.error(e.message);
                    reject(e);
                });
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
        });
    }
}
module.exports = { mod: new Mod() };
//# sourceMappingURL=mod.js.map