import {
  ApplicationCommandOptionType,
  CacheType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import getInternshipOppertunitiesJob from '../../jobs/fetchInternships';
import Command from '../classes/Command';
import DiscordClient from '../classes/DiscordClient';
import Category from '../enums/Category';

export default class Test extends Command {
  constructor(client: DiscordClient) {
    super(client, {
      name: 'fetchinternships',
      description: 'Fetch todays internships from the Simplify Repo.',
      category: Category.Utilities,
      options: {},
      default_member_permissions: PermissionFlagsBits.UseApplicationCommands,
      dm_permission: true,
      cooldown: 3,
    });
  }

  async Execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await getInternshipOppertunitiesJob(
        this.client,
        interaction.guild ?? null,
      )();
      const companiesText = result.companies
        .map((c) => `${c.company}: [${c.jobTitle}](${c.link})`)
        .join('\n');
      const sectionText = result.cleanedTable;

      if (companiesText.length < 1900 && sectionText.length < 1900) {
        await interaction.followUp({
          content: `**Companies:**\n${companiesText}\n\n**Table:**\n${sectionText}`,
        });
      } else {
        await interaction.followUp({
          files: [
            {
              attachment: Buffer.from(companiesText, 'utf8'),
              name: 'companies_output.md',
            },
          ],
        });
        await interaction.followUp({
          files: [
            {
              attachment: Buffer.from(sectionText, 'utf8'),
              name: 'section_output.md',
            },
          ],
        });
      }
    } catch (err: Error | any) {
      if (err instanceof Error) {
        await interaction.followUp({
          content: `Error fetching internships: ${err.message}`,
        });
      } else {
        await interaction.followUp({
          content: `Error fetching internships: ${err}`,
        });
      }
    }
  }
}
