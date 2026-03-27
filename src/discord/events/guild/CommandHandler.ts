import { ChatInputCommandInteraction, Collection, EmbedBuilder, Events, GuildMember } from "discord.js";
import DiscordClient from "../../classes/DiscordClient";
import Event from "../../classes/Event";
import { CONFIG } from "../../..";

export default class CommandHandler extends Event {

    constructor(client: DiscordClient) {
        super(client, {
            name: Events.InteractionCreate,
            description: "Command handler event.",
            once: false, // want this to be able to run multiple times
            // TODO why #3 13:00
        })
    }

    Execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.isChatInputCommand()) return;

        const command = this.client.commands.get(interaction.commandName);

        if (!command) {
            // delete inapplicable command
            this.client.commands.delete(interaction.commandName);
            return interaction.reply({ content: "Command not found.", ephemeral: true });
        }

        if (["sync", "test"].includes(interaction.commandName)) {
            const member = interaction.member;
            const hasBoardRole = member instanceof GuildMember
                ? member.roles.cache.has(CONFIG.discord.board_role_id)
                : false;

            if (!hasBoardRole) {
                return interaction.reply({
                    content: "You do not have permission to use this command.",
                    ephemeral: true,
                });
            }
        }

        const { cooldowns } = this.client;
        if (!cooldowns.has(command.name)) {
            cooldowns.set(command.name, new Collection());
        }

        const now = Date.now();
        const timestamps = cooldowns.get(command.name)!; // we just added empty mapping above if not there
        const cooldownAmount = (command.cooldown || 3) * 1000; // in miliseconds

        if (timestamps.has(interaction.user.id) && (now < (timestamps.get(interaction.user.id) || 0) + cooldownAmount)) {
            const secondsLeft = (((timestamps.get(interaction.user.id) || 0) + cooldownAmount) - now) / 1000;
            return interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor("Red")
                    .setDescription(`❌ Please wait another \`${secondsLeft.toFixed(1)}\` seconds to run this command again.`)
                ], ephemeral: true
            });
        }

        // record the timestamp that this user used this command
        timestamps.set(interaction.user.id, now);
        // remember to delete the timestamp after the cooldown is over
        setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

        try {
            // false means don't throw error if subcommands not found
            const subCommandGroup = interaction.options.getSubcommandGroup(false);
            // build the subcommand string, subcommandgroup & subcommand separated by a dot
            const subCommand = `${interaction.commandName}${subCommandGroup ? `.${subCommandGroup}` : ""}.${interaction.options.getSubcommand(false) || ""}`;
            // try to execute subcommand, if not found, execute the command
            return this.client.subCommands.get(subCommand)?.Execute(interaction) || command.Execute(interaction);
        } catch (error) {
            // TODO handle this better
            // e.g. log to database or discord channel
            console.error(error);
        }

    }

}
