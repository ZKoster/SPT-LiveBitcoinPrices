import { DependencyContainer } from "tsyringe";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor";
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor";

class Mod implements IPostDBLoadMod
{
    postDBLoad(container: DependencyContainer): void 
    {
        // get the logger from the server container
        const logger = container.resolve<ILogger>("WinstonLogger");
        
        logger.info("I am logging info!");
        logger.warning("I am logging a warning!");
        logger.error("I am logging an error!");
        logger.logWithColor("I am logging with color!", LogTextColor.YELLOW, LogBackgroundColor.RED);
    }
}

module.exports = { mod: new Mod() }