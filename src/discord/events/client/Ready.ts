import { Collection, Events, Message, REST, Routes, TextChannel } from "discord.js";
import DiscordClient from "../../classes/DiscordClient";
import Event from "../../classes/Event";
import Command from "../../classes/Command";
import { RecurrenceRule, scheduleJob } from "node-schedule";
import getDiscordEventsJob from "../../../jobs/syncDiscordEventsJob";
import getInternshipOppertunitiesJob from "../../../jobs/fetchInternships";
import getNewGradOpportunitiesJob from "../../../jobs/fetchNewGrads";
import Logger from "../../../utils/Logger";
import { CONFIG } from "../../..";
import { buildInternshipMessagesWithTitle } from "../../../utils/formatInternshipsForDiscord";
import { buildOpportunityMessagesWithTitle } from "../../../utils/formatOpportunitiesForDiscord";
import { selectHighlightedInternships } from "../../../jobs/selectHighlightedInternships";
import { selectHighlightedNewGrads } from "../../../jobs/selectHighlightedNewGrads";
import { getInternshipsForCategory } from "../../../jobs/internshipStore";
import { getNewGradsForCategory } from "../../../jobs/newGradStore";

const DISCORD_MESSAGE_LIMIT = 2000;

export default class Ready extends Event {
    constructor(client: DiscordClient) {
        super(client,
            {
                name: Events.ClientReady,
                description: "Event that gets emitted when the client is ready.",
                once: true
            });
    }

    async Execute() {
        Logger.once("setup", "Client is ready.")

        if (!this.verifySecrets()) return;

        this.registerCommands();
        this.setupSync();
    }

    private registerCommands = async () => {
        // format the commands into JSON to send tot discord
        const commands: object[] = this.GetJson(this.client.commands);
        const rest = new REST().setToken(process.env.DISCORD_APP_TOKEN!);

        const setCommands: any = await rest.put(Routes.applicationCommands(
            process.env.DISCORD_CLIENT_ID!,
        ), {
            body: commands
        }).catch((err) => {
            console.error("Error setting commands: ", err);
        })
        Logger.once("setup", `Successfully registered ${setCommands.length} commands.`)
    }

    /**
     * Schedule jobs that need to run at intervals.
     * Currently: sync notion events to discord, send upcoming events message
     */
    private setupSync = () => {
        const rule = new RecurrenceRule();
        rule.hour = 8;
        rule.minute = 15;
        rule.tz = "America/Los_Angeles";

        this.client.guilds.cache.forEach(guild => {
            scheduleJob(rule, getDiscordEventsJob(this.client, guild));
        })

        scheduleJob(rule, async () => {
            try {
                const internshipStore = await getInternshipOppertunitiesJob(this.client)();
                const newGradStore = await getNewGradOpportunitiesJob(this.client)();
                const allInternships = getInternshipsForCategory("ALL", internshipStore);
                const allNewGrads = getNewGradsForCategory("ALL", newGradStore);
                const highlightedInternships = await selectHighlightedInternships(this.client, internshipStore);
                const highlightedNewGrads = await selectHighlightedNewGrads(this.client, newGradStore);
                const internshipMessages = buildInternshipMessagesWithTitle(
                    highlightedInternships,
                    `**Today's highlighted internships:**`
                );
                const newGradMessages = buildOpportunityMessagesWithTitle(
                    highlightedNewGrads,
                    `**Today's highlighted new grad roles:**`
                );
                const messages = [
                    ...internshipMessages,
                    `**${allInternships.length}** internships were posted today.\nUse \`/fetchinternships\` with a category to see the rest.`,
                    ...newGradMessages,
                    `**${allNewGrads.length}** new grad roles were posted today.\nUse \`/fetchnewgrads\` with a category to see the rest.`,
                ];

                if (allInternships.length === 0 && allNewGrads.length === 0) {
                    return;
                }

                if (!CONFIG.discord.internships.channel_id) {
                    console.error("Internship channel id is missing.");
                    return;
                }

                for (const guild of this.client.guilds.cache.values()) {
                    const targetChannel = guild.channels.cache.find(
                        (channel) => channel.id === CONFIG.discord.internships.channel_id && channel.isTextBased()
                    );

                    if (!targetChannel || !targetChannel.isTextBased()) {
                        console.error("Target channel not found or is not text-based.");
                        continue;
                    }

                    await this.sendAnnouncementMessages(
                        targetChannel as TextChannel,
                        messages,
                        "Daily opportunities announcement"
                    );
                }
            } catch (error) {
                console.error("Error executing daily opportunities job:", error);
            }
        });

        Logger.once("setup", "Successfully set up interval sync.")
    }

    private sendAnnouncementMessages = async (
        targetChannel: TextChannel,
        messages: string[],
        label: string
    ) => {
        const invalidMessageIndex = messages.findIndex(
            (message) => message.length > DISCORD_MESSAGE_LIMIT
        );

        if (invalidMessageIndex !== -1) {
            throw new Error(
                `${label} message ${invalidMessageIndex + 1}/${messages.length} is ${messages[invalidMessageIndex].length} characters, which exceeds Discord's ${DISCORD_MESSAGE_LIMIT} character limit.`
            );
        }

        const sentMessages: Message[] = [];

        try {
            for (const message of messages) {
                sentMessages.push(await targetChannel.send(message));
            }
        } catch (error) {
            console.error(
                `${label} failed after sending ${sentMessages.length}/${messages.length} messages. Deleting partial announcement so the header is not left behind.`,
                error
            );

            for (const sentMessage of sentMessages.reverse()) {
                await sentMessage.delete().catch((deleteError) => {
                    console.error(`${label} could not delete partial message ${sentMessage.id}:`, deleteError);
                });
            }

            throw error;
        }
    }


    private GetJson(commands: Collection<string, Command>): object[] {
        const data: object[] = [];

        commands.forEach(command => {
            data.push({
              name: command.name,
              description: command.description,
              options: command.options,
              default_member_permissions:
                command.default_member_permissions !== undefined
                  ? command.default_member_permissions.toString()
                  : null,
              dm_permission: command.dm_permission,
            });
        })

        return data;
    }

    private verifySecrets(): boolean {

        if (!process.env.DISCORD_APP_TOKEN) {
            console.error("Discord app token is missing.");
            return false;
        }

        if (!process.env.DISCORD_CLIENT_ID) {
            console.error("Discord client id is missing.");
            return false;
        }

        if (!CONFIG.discord.server_id) {
            console.error("Discord guild id is missing.");
            return false;
        }

        return true;
    }

}
