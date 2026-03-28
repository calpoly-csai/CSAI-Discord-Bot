import { Collection, Events, REST, Routes, TextChannel } from "discord.js";
import DiscordClient from "../../classes/DiscordClient";
import Event from "../../classes/Event";
import Command from "../../classes/Command";
import { RecurrenceRule, scheduleJob } from "node-schedule";
import getDiscordEventsJob from "../../../jobs/syncDiscordEventsJob";
import getInternshipOppertunitiesJob from "../../../jobs/fetchInternships";
import Logger from "../../../utils/Logger";
import { CONFIG } from "../../..";
import { buildInternshipMessagesWithTitle } from "../../../utils/formatInternshipsForDiscord";
import { selectHighlightedInternships } from "../../../jobs/selectHighlightedInternships";
import { getInternshipsForCategory } from "../../../jobs/internshipStore";

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

        const setCommands: any = await rest.put(Routes.applicationGuildCommands(
            process.env.DISCORD_CLIENT_ID!,
            CONFIG.discord.server_id,
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
                const store = await getInternshipOppertunitiesJob(this.client)();
                const allInternships = getInternshipsForCategory("ALL", store);
                const highlightedInternships = await selectHighlightedInternships(this.client, store);
                const outroMessage = `**${allInternships.length}** internships were posted today.\nUse \`/fetchinternships\` with a category to see the rest.`;
                const messages = buildInternshipMessagesWithTitle(
                    highlightedInternships,
                    `**Today's highlighted internships:**`
                );

                if (allInternships.length === 0) {
                    return;
                }

                for (const guild of this.client.guilds.cache.values()) {
                    const targetChannel = guild.channels.cache.find(
                        (channel) => channel.name === "opportunities-test" && channel.isTextBased()
                    );

                    if (!targetChannel || !targetChannel.isTextBased()) {
                        console.error("Target channel not found or is not text-based.");
                        continue;
                    }

                    for (const message of messages) {
                        await (targetChannel as TextChannel).send(message);
                    }

                    await (targetChannel as TextChannel).send(outroMessage);
                }
            } catch (error) {
                console.error("Error executing internship job:", error);
            }
        });

        Logger.once("setup", "Successfully set up interval sync.")
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
