import { ApplicationCommandOptionType, CacheType, ChatInputCommandInteraction, PermissionFlagsBits } from "discord.js";
import Command from "../classes/Command";
import DiscordClient from "../classes/DiscordClient";
import Category from "../enums/Category";

export default class Test extends Command {
    constructor(client: DiscordClient) {
        super(
            client,
            {
                name: "fetchinternships",
                description: "Fetch todays internships from the Simplify Repo.",
                category: Category.Utilities,
                options: {},
                default_member_permissions: PermissionFlagsBits.UseApplicationCommands,
                dm_permission: true,
                cooldown: 3,
            }
        )
    }
    
    async Execute(interaction: ChatInputCommandInteraction) {
        interaction.deferReply({ ephemeral: true });
        let res = await this.client.llm.prompt("respond briefly to a 'test' message with something creative") || "Confirmed...";

        interaction.followUp(res);
    }
}