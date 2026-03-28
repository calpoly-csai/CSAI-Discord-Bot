import { ChatInputCommandInteraction } from "discord.js";
import DiscordClient from "../classes/DiscordClient";
import SubCommand from "../classes/SubCommand";
import getInternshipOppertunitiesJob from "../../jobs/fetchInternships";
import { getInternshipsForCategory } from "../../jobs/internshipStore";
import { CONFIG } from "../..";

export default class SyncInternships extends SubCommand {
    constructor(client: DiscordClient) {
        super(client, {
            name: "sync.internships",
        })
    }

    async Execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const store = await getInternshipOppertunitiesJob(this.client)();
            const internships = getInternshipsForCategory("ALL", store);

            await interaction.followUp({
                content: `Checked internships and found **${internships.length}** posted today. See logs in <#${CONFIG.discord.logs.channel_id}>.`,
                ephemeral: true,
            });
        } catch (error) {
            await interaction.followUp({
                content: `Error checking internships. See logs in <#${CONFIG.discord.logs.channel_id}>.`,
                ephemeral: true,
            });
        }
    }
}
