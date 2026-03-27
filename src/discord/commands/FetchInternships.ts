import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import Command from '../classes/Command';
import DiscordClient from '../classes/DiscordClient';
import Category from '../enums/Category';
import {
  InternshipRequestType,
  getInternshipsForCategory,
  getInternshipStore,
} from '../../jobs/internshipStore';
import { buildInternshipMessagesWithTitle } from '../../utils/formatInternshipsForDiscord';

function getCategoryLabel(category: InternshipRequestType): string {
  switch (category) {
    case 'SWE':
      return 'Software Engineering';
    case 'AI':
      return 'AI / Data Science / Machine Learning';
    case 'PM':
      return 'Product Management';
    case 'QUANT':
      return 'Quantitative Finance';
    case 'HWE':
      return 'Hardware Engineering';
    case 'ALL':
      return 'All internship categories';
    default:
      return category;
  }
}

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
    const category = interaction.options.getString('category', true) as InternshipRequestType;
    await interaction.deferReply({ ephemeral: true });
    try {
      const store = getInternshipStore();

      if (!store.lastUpdatedAt) {
        await interaction.followUp({
          content: 'No internships have been posted yet.',
          ephemeral: true,
        });
        return;
      }

      const postings = getInternshipsForCategory(category, store);
      if (postings.length === 0) {
        await interaction.followUp({
          content: `No ${category} internships were posted today.`,
          ephemeral: true,
        });
        return;
      }

      const categoryLabel = getCategoryLabel(category);
      const title = `<@${interaction.user.id}> **Today's ${categoryLabel} internships (${postings.length} posted):**`;
      const messages = buildInternshipMessagesWithTitle(postings, title);

      for (const message of messages) {
        await interaction.followUp({ content: message, ephemeral: true });
      }
    } catch (err: Error | any) {
      if (err instanceof Error) {
        await interaction.followUp({
          content: `Error fetching internships: ${err.message}`,
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: `Error fetching internships: ${err}`,
          ephemeral: true,
        });
      }
    }
  }
}
