import DiscordClient from '../discord/classes/DiscordClient';
import Logger from '../utils/Logger';
import {
  OpportunityPosting,
  OpportunitySection,
} from './opportunityParser';

type RankedOpportunityPosting<T extends string> = OpportunityPosting & {
  type: T;
};

const MIN_HIGHLIGHTS = 8;
const ABSOLUTE_MAX_HIGHLIGHTS = 20;

function getRankedOpportunities<T extends string>(
  sections: OpportunitySection<T>[],
  opportunitiesByType: Record<T, OpportunityPosting[]>,
): RankedOpportunityPosting<T>[] {
  return sections.flatMap((section) =>
    opportunitiesByType[section.name].map((posting) => ({
      ...posting,
      type: section.name,
    })),
  );
}

function getHighlightCount(totalPostings: number): number {
  if (totalPostings <= MIN_HIGHLIGHTS) {
    return totalPostings;
  }

  return Math.min(
    ABSOLUTE_MAX_HIGHLIGHTS,
    Math.max(MIN_HIGHLIGHTS, Math.ceil(totalPostings / 5)),
  );
}

function buildHighlightPrompt<T extends string>(
  postings: RankedOpportunityPosting<T>[],
  maxHighlights: number,
  opportunityLabel: string,
): string {
  const payload = postings.map((posting, index) => ({
    index,
    type: posting.type,
    company: posting.company,
    jobTitle: posting.jobTitle,
    link: posting.link,
  }));

  return `You are selecting standout ${opportunityLabel} for a Discord announcement.
Choose up to ${maxHighlights} postings that are the most broadly appealing, recognizable, high-signal, or especially compelling.
Favor strong company recognition, interesting role focus, and variety across opportunity types when possible.

Return valid JSON only in this shape:
{"highlights":[0,1,2]}

Rules:
- Only include indexes from the provided list.
- Do not include more than ${maxHighlights} indexes.
- Do not include duplicate indexes.
- Prefer a diverse set rather than many nearly identical roles.

Opportunities:
${JSON.stringify(payload)}`;
}

function parseHighlightIndexes(
  raw: string | void,
  total: number,
  maxHighlights: number,
  logPrefix: string,
): number[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as { highlights?: unknown };
    if (!Array.isArray(parsed.highlights)) {
      return [];
    }

    return parsed.highlights
      .filter((value): value is number => Number.isInteger(value))
      .filter((value, index, array) => array.indexOf(value) === index)
      .filter((value) => value >= 0 && value < total)
      .slice(0, maxHighlights);
  } catch (error) {
    Logger.once(logPrefix, `Failed to parse Gemini highlight response: ${raw}`);
    return [];
  }
}

export async function selectHighlightedOpportunities<T extends string>(
  client: DiscordClient,
  sections: OpportunitySection<T>[],
  opportunitiesByType: Record<T, OpportunityPosting[]>,
  opportunityLabel: string,
  logPrefix: string,
): Promise<OpportunityPosting[]> {
  const rankedOpportunities = getRankedOpportunities(sections, opportunitiesByType);
  const maxHighlights = getHighlightCount(rankedOpportunities.length);

  if (rankedOpportunities.length <= maxHighlights) {
    return rankedOpportunities;
  }

  const response = await client.llm.prompt(
    buildHighlightPrompt(rankedOpportunities, maxHighlights, opportunityLabel),
  );
  const selectedIndexes = parseHighlightIndexes(
    response,
    rankedOpportunities.length,
    maxHighlights,
    logPrefix,
  );

  if (selectedIndexes.length === 0) {
    return rankedOpportunities.slice(0, maxHighlights);
  }

  return selectedIndexes.map((index) => rankedOpportunities[index]);
}
