import { ChatInputCommandInteraction } from "discord.js";
import SubCommand from "../classes/SubCommand";
import DiscordClient from "../classes/DiscordClient";
import getNewGradOpportunitiesJob from "../../jobs/fetchNewGrads";
import { getNewGradsForCategory } from "../../jobs/newGradStore";
import { CONFIG } from "../..";

export default class SyncNewGrads extends SubCommand {
    constructor(client: DiscordClient) {
        super(client, {
            name: "sync.newgrads",
        })
    }

    async Execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const store = await getNewGradOpportunitiesJob(this.client)();
            const newGrads = getNewGradsForCategory("ALL", store);

            await interaction.followUp({
                content: `Checked new grad roles and found **${newGrads.length}** posted today. See logs in <#${CONFIG.discord.logs.channel_id}>.`,
                ephemeral: true,
            });
        } catch (error) {
            await interaction.followUp({
                content: `Error checking new grad roles. See logs in <#${CONFIG.discord.logs.channel_id}>.`,
                ephemeral: true,
            });
        }
    }
}
