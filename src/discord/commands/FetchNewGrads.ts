import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import Command from '../classes/Command';
import DiscordClient from '../classes/DiscordClient';
import Category from '../enums/Category';
import {
  NewGradRequestType,
  getNewGradStore,
  getNewGradsForCategory,
} from '../../jobs/newGradStore';
import { buildOpportunityMessagesWithTitle } from '../../utils/formatOpportunitiesForDiscord';

function getCategoryLabel(category: NewGradRequestType): string {
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
    case 'OTHER':
      return 'Other';
    case 'ALL':
      return 'All new grad categories';
    default:
      return category;
  }
}

export default class FetchNewGrads extends Command {
  constructor(client: DiscordClient) {
    super(client, {
      name: 'fetchnewgrads',
      description: "Fetch today's new grad roles from the Simplify Repo.",
      category: Category.Utilities,
      options: [
        {
          name: 'category',
          description: 'Type of new grad role',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            { name: '💻 Software Engineering New Grad Roles', value: 'SWE' },
            { name: '🤖 Data Science, AI & Machine Learning New Grad Roles', value: 'AI' },
            { name: '📱 Product Management New Grad Roles', value: 'PM' },
            { name: '📈 Quantitative Finance New Grad Roles', value: 'QUANT' },
            { name: '🔧 Hardware Engineering New Grad Roles', value: 'HWE' },
            { name: '💼 Other New Grad Roles', value: 'OTHER' },
            { name: 'All (Will take longer)', value: 'ALL' },
          ],
        },
      ],
      default_member_permissions: PermissionFlagsBits.UseApplicationCommands,
      dm_permission: true,
      cooldown: 3,
    });
  }

  async Execute(interaction: ChatInputCommandInteraction) {
    const category = interaction.options.getString('category', true) as NewGradRequestType;
    await interaction.deferReply({ ephemeral: true });

    try {
      const store = getNewGradStore();

      if (!store.lastUpdatedAt) {
        await interaction.followUp({
          content: 'No new grad roles have been posted yet.',
          ephemeral: true,
        });
        return;
      }

      const postings = getNewGradsForCategory(category, store);
      if (postings.length === 0) {
        await interaction.followUp({
          content: `No ${category} new grad roles were posted today.`,
          ephemeral: true,
        });
        return;
      }

      const categoryLabel = getCategoryLabel(category);
      const title = `<@${interaction.user.id}> **Today's ${categoryLabel} new grad roles (${postings.length} posted):**`;
      const messages = buildOpportunityMessagesWithTitle(postings, title);

      for (const message of messages) {
        await interaction.followUp({ content: message, ephemeral: true });
      }
    } catch (err: Error | any) {
      if (err instanceof Error) {
        await interaction.followUp({
          content: `Error fetching new grad roles: ${err.message}`,
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: `Error fetching new grad roles: ${err}`,
          ephemeral: true,
        });
      }
    }
  }
}
