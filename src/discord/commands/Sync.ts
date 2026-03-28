import { ApplicationCommandOptionType } from "discord.js";
import Category from "../enums/Category";
import DiscordClient from "../classes/DiscordClient";
import Command from "../classes/Command";

export default class Sync extends Command{

    constructor(client: DiscordClient) {
        super(
            client,
            {
                name: "sync",
                description: "Manually trigger an events sync from Notion to either Discord or GCal.",
                category: Category.Utilities,
                default_member_permissions: BigInt(0),
                dm_permission: true,
                cooldown: 3,
                options: [
                    {
                        name: "discord",
                        description: "sync events with Discord events",
                        type: ApplicationCommandOptionType.Subcommand
                    },
                    {
                        name: "gcal",
                        description: "sync events with Google Calendar",
                        type: ApplicationCommandOptionType.Subcommand
                    },
                    {
                        name: "internships",
                        description: "pull and check for newly posted internships",
                        type: ApplicationCommandOptionType.Subcommand
                    },
                ]
    
            }
        )
    }
}
