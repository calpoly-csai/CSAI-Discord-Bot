import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

export type OpportunityPosting = {
  company: string;
  jobTitle: string;
  link: string;
};

export type OpportunitySection<T extends string> = {
  name: T;
  header: string;
};

const EMOJI_REGEX =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function stripEmoji(value: string): string {
  return value.replace(EMOJI_REGEX, '').trim();
}

function isOlderThanTodayAgeRow(line: string): boolean {
  const ageMatch = line.match(/<td[^>]*>\s*([^<]+)\s*<\/td>\s*$/i);
  if (!ageMatch) {
    return false;
  }

  const age = ageMatch[1].trim().toLowerCase();

  if (age === '0d') {
    return false;
  }

  return /^\d+\s*[a-z]+$/.test(age);
}

function extractSectionTable(readmeContent: string, sectionHeader: string): string {
  const lines = readmeContent.split('\n');
  let sectionStarted = false;
  let sectionContent = '';

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === sectionHeader) {
      sectionStarted = true;
      continue;
    }

    if (sectionStarted && !sectionContent && trimmedLine.startsWith('<table')) {
      sectionContent += `${line}\n`;
      continue;
    }

    if (sectionStarted && sectionContent) {
      if (isOlderThanTodayAgeRow(line)) break;

      sectionContent += `${line}\n`;

      if (trimmedLine.startsWith('</table>')) break;
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
  let modified = tableHtml.replace(/<th[^>]*>\s*Location\s*<\/th>/gi, '');
  modified = modified.replace(/<th[^>]*>\s*Age\s*<\/th>/gi, '');

  modified = modified.replace(
    /(<tr[^>]*>[\s\S]*?(<td[^>]*>[\s\S]*?<\/td>)+[\s\S]*?<\/tr>)/gi,
    (match) => {
      const tdMatches = [...match.matchAll(/<td[^>]*>[\s\S]*?<\/td>/gi)];
      if (tdMatches.length >= 5) {
        tdMatches.splice(2, 1);
        tdMatches.splice(3, 1);
        const trStart = match.match(/^<tr[^>]*>/i)?.[0] || '';
        const trEnd = match.match(/<\/tr>$/i)?.[0] || '';
        return trStart + tdMatches.map((m) => m[0]).join('') + trEnd;
      }
      return match;
    },
  );

  modified = modified.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (rowMatch) => {
    const tdMatches = [...rowMatch.matchAll(/<td[^>]*>[\s\S]*?<\/td>/gi)];
    if (tdMatches.length === 0) return rowMatch;

    for (let i = 0; i < tdMatches.length - 1; i++) {
      tdMatches[i][0] = tdMatches[i][0].replace(
        /<a[^>]*>[\s\S]*?<\/a>/gi,
        (aMatch) => aMatch.replace(/<a[^>]*>([\s\S]*?)<\/a>/i, '$1'),
      );
    }

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
      },
    );

    tdMatches.forEach((td) => {
      td[0] = td[0]
        .replace(
          /src="https:\/\/i\.imgur\.com\/fbjwDvo\.png"/gi,
          'src="https://i.imgur.com/6cFAMUo.png"',
        )
        .replace(/width="5[02]"/gi, 'width="80"');
    });

    const trStart = rowMatch.match(/^<tr[^>]*>/i)?.[0] || '';
    const trEnd = rowMatch.match(/<\/tr>$/i)?.[0] || '';
    return trStart + tdMatches.map((m) => m[0]).join('') + trEnd;
  });

  return modified;
}

function extractPostings(tableHtml: string): OpportunityPosting[] {
  const postings: OpportunityPosting[] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = match[1];
    const tdMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (tdMatches.length < 3) continue;

    const company = stripTags(tdMatches[0][1]);
    const jobTitle = stripEmoji(stripTags(tdMatches[1][1]));
    if (/phd|doctor of philosophy/i.test(jobTitle)) continue;

    const linkMatch = tdMatches[tdMatches.length - 1][1].match(
      /<a[^>]*href="([^"]+)"[^>]*>/i,
    );
    const link = linkMatch ? linkMatch[1] : '';

    postings.push({ company, jobTitle, link });
  }

  return postings;
}

export function buildOpportunityGroups<T extends string>(
  readmeContent: string,
  sections: OpportunitySection<T>[],
): {
  opportunitiesByType: Record<T, OpportunityPosting[]>;
  cleanedTable: string;
} {
  const opportunitiesByType = {} as Record<T, OpportunityPosting[]>;
  let fullCleanedTable = '';

  for (const section of sections) {
    const sectionTable = extractSectionTable(readmeContent, section.header);
    const cleanedTable = cleanTableHtml(sectionTable);
    opportunitiesByType[section.name] = extractPostings(cleanedTable);
    fullCleanedTable += `${cleanedTable}\n`;
  }

  return { opportunitiesByType, cleanedTable: fullCleanedTable };
}

export function writeOpportunityOutputFiles(
  sectionOutputPath: string,
  companiesOutputPath: string,
  tableHtml: string,
  postings: OpportunityPosting[],
) {
  mkdirSync(path.dirname(sectionOutputPath), { recursive: true });
  mkdirSync(path.dirname(companiesOutputPath), { recursive: true });
  writeFileSync(sectionOutputPath, tableHtml.trim(), { encoding: 'utf8' });
  const companiesOutput = postings
    .map(({ company, jobTitle, link }) => `${company}: [${jobTitle}](<${link}>)`)
    .join('\n');
  writeFileSync(companiesOutputPath, companiesOutput, { encoding: 'utf8' });
}
