import DiscordClient from '../discord/classes/DiscordClient';
import Logger from '../utils/Logger';
import {
  INTERNSHIP_SECTIONS,
  InternshipPosting,
  InternshipStore,
  InternshipType,
} from './internshipStore';

type RankedInternshipPosting = InternshipPosting & {
  type: InternshipType;
};

const MIN_HIGHLIGHTS = 8;
const ABSOLUTE_MAX_HIGHLIGHTS = 20;

function getRankedInternships(store: InternshipStore): RankedInternshipPosting[] {
  return INTERNSHIP_SECTIONS.flatMap((section) =>
    store.internshipsByType[section.name].map((posting) => ({
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

function buildHighlightPrompt(
  postings: RankedInternshipPosting[],
  maxHighlights: number,
): string {
  const payload = postings.map((posting, index) => ({
    index,
    type: posting.type,
    company: posting.company,
    jobTitle: posting.jobTitle,
    link: posting.link,
  }));

  return `You are selecting standout internship postings for a Discord announcement.
Choose up to ${maxHighlights} postings that are the most broadly appealing, recognizable, high-signal, or especially compelling.
Favor strong company recognition, interesting role focus, and variety across internship types when possible.

Return valid JSON only in this shape:
{"highlights":[0,1,2]}

Rules:
- Only include indexes from the provided list.
- Do not include more than ${maxHighlights} indexes.
- Do not include duplicate indexes.
- Prefer a diverse set rather than many nearly identical roles.

Internships:
${JSON.stringify(payload)}`;
}

function parseHighlightIndexes(
  raw: string | void,
  total: number,
  maxHighlights: number,
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
    Logger.once(
      'Internship Highlights',
      `Failed to parse Gemini highlight response: ${raw}`,
    );
    return [];
  }
}

export async function selectHighlightedInternships(
  client: DiscordClient,
  store: InternshipStore,
): Promise<InternshipPosting[]> {
  const rankedInternships = getRankedInternships(store);
  const maxHighlights = getHighlightCount(rankedInternships.length);

  if (rankedInternships.length <= maxHighlights) {
    return rankedInternships;
  }

  const response = await client.llm.prompt(
    buildHighlightPrompt(rankedInternships, maxHighlights),
  );
  const selectedIndexes = parseHighlightIndexes(
    response,
    rankedInternships.length,
    maxHighlights,
  );

  if (selectedIndexes.length === 0) {
    return rankedInternships.slice(0, maxHighlights);
  }

  return selectedIndexes.map((index) => rankedInternships[index]);
}
