import {
  ApplicationCommandOptionType,
  CacheType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import getInternshipOppertunitiesJob from '../../jobs/fetchInternships';
import Command from '../classes/Command';
import DiscordClient from '../classes/DiscordClient';
import Category from '../enums/Category';
import fetch from 'node-fetch';

async function generateCompaniesText(
  companies: { company: string; jobTitle: string; link: string }[],
) {
  const totalCount = companies.length;
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const listForModel = companies
    .map((c, i) => `${i + 1}. ${c.company}: [${c.jobTitle}](<${c.link}>)`)
    .join('\n');

  const prompt = `
${today} Internship Postings Summary
We found ${totalCount} new internships posted today!

Here are some of our favorites
1.
2.
3.
4.
5.
6.
7.
8.
9.
10.

Format: \${c.company}: [\${c.jobTitle}](<\${c.link}>)

INSTRUCTIONS FOR THE MODEL:
- From the list below, select up to 10 best internships and fill items 1-10 using the exact Format above.
- Only output the summary in the exact structure shown (date line, count line, "Here are some of our favorites", numbered list up to 10, and the final line about !fetch). Do NOT add any extra explanation, commentary, or anything else.
- If fewer than 10 top picks exist, only output the items available but keep numbering starting from 1.
- ALWAYS use the count ${totalCount} in the "We found" line.

AVAILABLE INTERNSHIPS:
${listForModel}
`.trim();

  try {
    const res = await fetch(
      'https://gemini.googleapis.com/v1/models/gemini-1-mini:generate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        },
        body: JSON.stringify({
          prompt: prompt,
          max_output_tokens: 800,
          temperature: 0.2,
        }),
      },
    );

    const json = await res.json();

    const text =
      (json?.candidates && json.candidates[0]?.content) ||
      json?.output?.[0]?.content ||
      json?.output_text ||
      json?.text ||
      (typeof json === 'string' ? json : null);

    if (text) return String(text).trim();
  } catch (err) {
    // fallback to local formatting
  }

  const fallbackItems = companies
    .slice(0, 10)
    .map((c, i) => `${i + 1}. ${c.company}: [${c.jobTitle}](<${c.link}>)`)
    .join('\n');
  return `${today} Internship Postings Summary
We found ${totalCount} new internships posted today!

Here are some of our favorites
${fallbackItems}`;
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
            {
              name: '🤖 Data Science, AI & Machine Learning Internship Roles',
              value: 'AI',
            },
            { name: '📱 Product Management Internship Roles', value: 'PM' },
            {
              name: '📈 Quantitative Finance Internship Roles',
              value: 'QUANT',
            },
            { name: '🔧 Hardware Engineering Internship Roles', value: 'HWE' },
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
    const category = interaction.options.getString('category', true);
    await interaction.deferReply({ ephemeral: true });
    try {
      const result = await getInternshipOppertunitiesJob(
        this.client,
        interaction.guild ?? null,
      )(category);
      
      const companiesLength = result.companies.length;
      if (companiesLength === 0) {
        await interaction.followUp({
          content: `No new ${category} internships were posted on our DB today.`,
        });
        return;
      }
      const companiesText = await generateCompaniesText(result.companies);
      
      // Split into embed if too long
      const embed = new EmbedBuilder()
        .setTitle('📋 Internship Postings Summary')
        .setDescription(companiesText.substring(0, 4096))
        .setColor('#0099ff');

      await interaction.editReply({ embeds: [embed] });

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
