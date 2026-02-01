import { Guild, GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel } from "discord.js";
import DiscordClient from '../discord/classes/DiscordClient';
import Logger from '../utils/Logger';
import { CONFIG } from '..';
import sendInternshipJobSummary from './sendInternshipJobSummary';
import { exec } from 'child_process';
import { createReadStream, writeFileSync } from 'fs';

// --- Constants ---
const README_PATH = '../Summer2026-Internships/README.md';
const SECTION_OUTPUT_PATH = '../Summer2026-Internships/section_output.md';
const COMPANIES_OUTPUT_PATH = '../Summer2026-Internships/companies_output.md';
const SECTION_HEADER = '## 🤖 Data Science, AI & Machine Learning Internship Roles';
const NAME = "Fetch Internship Opportunities";

// --- Utility Functions ---
function gitPullInternshipsRepo(): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      'cd ../Summer2026-Internships && git pull origin && cd ../glassic-bot',
      (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve(stdout);
      }
    );
  });
}

function extractSectionTable(readmeContent: string): string {
  const lines = readmeContent.split('\n');
  let sectionStarted = false;
  let sectionContent = '';

  for (const line of lines) {
    if (line.trim() === SECTION_HEADER) {
      sectionStarted = true;
      continue;
    }
    if (
      sectionStarted &&
      !sectionContent &&
      line.trim().startsWith('<table>')
    ) {
      sectionContent += line + '\n';
      continue;
    }
    if (sectionStarted && sectionContent) {
      if (line.endsWith('<td>1d</td>')) break;
      sectionContent += line + '\n';
    }
  }

  while (sectionContent && !sectionContent.trim().endsWith('</tr>')) {
    const lastNewline = sectionContent.lastIndexOf('\n');
    if (lastNewline === -1) break;
    sectionContent = sectionContent.slice(0, lastNewline);
  }

  return sectionContent;
}

function cleanTableHtml(tableHtml: string): string {
  // Remove unwanted columns (Location, Age)
  let modified = tableHtml.replace(/<th>\s*Location\s*<\/th>/gi, '');
  modified = modified.replace(/<th>\s*Age\s*<\/th>/gi, '');

  // Remove <td> for Location and Age in each row (assumes order)
  modified = modified.replace(
    /(<tr[^>]*>[\s\S]*?(<td[^>]*>[\s\S]*?<\/td>)+[\s\S]*?<\/tr>)/gi,
    (match) => {
      let tdMatches = [...match.matchAll(/<td[^>]*>[\s\S]*?<\/td>/gi)];
      if (tdMatches.length >= 5) {
        tdMatches.splice(2, 1); // Remove 3rd
        tdMatches.splice(3, 1); // Remove 5th
        const trStart = match.match(/^<tr[^>]*>/i)?.[0] || '';
        const trEnd = match.match(/<\/tr>$/i)?.[0] || '';
        return trStart + tdMatches.map((m) => m[0]).join('') + trEnd;
      }
      return match;
    }
  );

  // Clean up links and images in table rows
  modified = modified.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (rowMatch) => {
    const tdMatches = [...rowMatch.matchAll(/<td[^>]*>[\s\S]*?<\/td>/gi)];
    if (tdMatches.length === 0) return rowMatch;

    // Remove <a> tags in non-last columns
    for (let i = 0; i < tdMatches.length - 1; i++) {
      tdMatches[i][0] = tdMatches[i][0].replace(
        /<a[^>]*>[\s\S]*?<\/a>/gi,
        (aMatch) => {
          return aMatch.replace(/<a[^>]*>([\s\S]*?)<\/a>/i, '$1');
        }
      );
    }
    // For last column, keep only first link
    tdMatches[tdMatches.length - 1][0] = tdMatches[
      tdMatches.length - 1
    ][0].replace(
      /(<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>)/gi,
      (match, aTag, href, offset, string) => {
        const allLinks = [
          ...string.matchAll(/<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi),
        ];
        if (allLinks.length > 1) {
          return offset === allLinks[0].index ? allLinks[0][0] : '';
        }
        return match;
      }
    );

    // Fix image src and width
    tdMatches.forEach((td, idx) => {
      td[0] = td[0]
        .replace(
          /src="https:\/\/i\.imgur\.com\/fbjwDvo\.png"/gi,
          'src="https://i.imgur.com/6cFAMUo.png"'
        )
        .replace(/width="50"/gi, 'width="80"');
    });

    const trStart = rowMatch.match(/^<tr[^>]*>/i)?.[0] || '';
    const trEnd = rowMatch.match(/<\/tr>$/i)?.[0] || '';
    return trStart + tdMatches.map((m) => m[0]).join('') + trEnd;
  });

  return modified;
}

function extractCompanies(
  tableHtml: string
): { company: string; jobTitle: string; link: string }[] {
  const companies: { company: string; jobTitle: string; link: string }[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = match[1];
    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 3) continue;

    const company = tdMatches[0][1].replace(/<[^>]+>/g, '').trim();
    let jobTitle = tdMatches[1][1].replace(/<[^>]+>/g, '');
    jobTitle = jobTitle
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ''
      )
      .trim();
    if (/phd|doctor of philosophy/i.test(jobTitle)) continue;

    const linkMatch = tdMatches[tdMatches.length - 1][1].match(
      /<a[^>]*href="([^"]+)"[^>]*>/i
    );
    const link = linkMatch ? linkMatch[1] : '';

    companies.push({ company, jobTitle, link });
  }
  return companies;
}

function writeOutputFiles(
  tableHtml: string,
  companies: { company: string; jobTitle: string; link: string }[]
) {
  writeFileSync(SECTION_OUTPUT_PATH, tableHtml.trim(), { encoding: 'utf8' });
  const companiesOutput = companies
    .map(({ company, jobTitle, link }) => `${company}: [${jobTitle}](${link})`)
    .join('\n');
  writeFileSync(COMPANIES_OUTPUT_PATH, companiesOutput, { encoding: 'utf8' });
}

// --- Main Function ---
const getInternshipOppertunitiesJob = (client: DiscordClient, guild: Guild | null) => async () => {
  try {
    const whenDone = (log: string, success: boolean) =>
        sendInternshipJobSummary(
            client,
            CONFIG.discord.logs.channel_id,
            NAME,
            log
        );
    const logger = new Logger(NAME, client, whenDone);

    logger.start();
    let success_new = 0;
    let success_edit = 0;
    let fail = 0;

    if (!guild) {
        logger.fail("Failed to fetch guild - guild with provided ID not found?.");
        return;
    }

    const gitOutput = await gitPullInternshipsRepo();
    logger.info(`Git pull output: ${gitOutput}`);

    let readmeContent = '';
    const readStream = createReadStream(README_PATH, { encoding: 'utf8' });

    readStream.on('data', (chunk) => {
      readmeContent += chunk;
    });

    readStream.on('end', () => {
      const sectionTable = extractSectionTable(readmeContent);
      const cleanedTable = cleanTableHtml(sectionTable);
      const companies = extractCompanies(cleanedTable);

      writeOutputFiles(cleanedTable, companies);
      logger.info(`Section content written to ${SECTION_OUTPUT_PATH}`);
      logger.info(`Companies list written to ${COMPANIES_OUTPUT_PATH}`);
    });

    readStream.on('error', (error) => {
      logger.fail(`Error reading README.md: ${error.message}`);
    });

    logger.info(`Successfully fetched and processed internship opportunities.`);
    logger.end();
    
  } catch (error) {
    console.log(`Error executing git pull: ${error}`);
  }
}

export default getInternshipOppertunitiesJob;
