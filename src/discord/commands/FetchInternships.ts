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
      options: [
        {
            name: 'category',
            description: 'Type of Internship',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: [
            { name: '💻 Software Engineering Internship Roles', value: 'SWE' },
            { name: '🤖 Data Science, AI & Machine Learning Internship Roles', value: 'AI' },
            { name: '📱 Product Management Internship Roles', value: 'PM' },
            { name: '📈 Quantitative Finance Internship Roles', value: 'QUANT' },
            { name: '🔧 Hardware Engineering Internship Roles', value: 'HWE' },
            { name: 'All (Will take longer)', value: 'ALL' },
            ],
        }
    ],
      default_member_permissions: PermissionFlagsBits.UseApplicationCommands,
      dm_permission: true,
      cooldown: 3,
    });
  }

  async Execute(interaction: ChatInputCommandInteraction) {
    const category = interaction.options.getString('category', true);
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await getInternshipOppertunitiesJob(
        this.client,
        interaction.guild ?? null,
      )(category);
      const companiesText = result.companies
        .map((c) => `${c.company}: [${c.jobTitle}](<${c.link}>)`)
        .join('\n');
      if (companiesText.length === 0) {
        await interaction.followUp({
          content: `No new ${category} internships were posted on our DB today.`,
        });
        return;
      }
      const sectionText = result.cleanedTable;

      /* removed && sectionText.length < 1900 from the if and \n\n**Table:**\n${sectionText} from content 
      for reasons explain in lower comment*/
      if (companiesText.length < 1900) {
        await interaction.followUp({
          content: `**Here are todays internships:**\n${companiesText}`,
        });
      } else {
        const chunks = companiesText.match(/[\s\S]{1,1900}(?=\n|$)/g); // Split into chunks of max 1900 characters, breaking at newlines
        if (chunks) {
          await interaction.followUp({ content: `**Here are todays internships:**` });
          for (const chunk of chunks) {
            await interaction.followUp({ content: chunk });
          }
        }
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
