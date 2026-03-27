import {
  InternshipPosting,
  InternshipRequestType,
  InternshipStore,
  getInternshipsForCategory,
} from '../jobs/internshipStore';

const DISCORD_MESSAGE_LIMIT = 1900;

export function formatInternshipPosting(posting: InternshipPosting): string {
  return `${posting.company}: [${posting.jobTitle}](<${posting.link}>)`;
}

export function buildInternshipMessages(postings: InternshipPosting[]): string[] {
  return buildInternshipMessagesWithTitle(postings, `**Here are today's internships:**`);
}

export function buildInternshipMessagesWithTitle(
  postings: InternshipPosting[],
  title: string,
): string[] {
  if (postings.length === 0) {
    return [];
  }

  const lines = postings.map(formatInternshipPosting);
  const messages = [title];
  let currentChunk = '';

  for (const line of lines) {
    const nextChunk = currentChunk ? `${currentChunk}\n${line}` : line;

    if (nextChunk.length > DISCORD_MESSAGE_LIMIT) {
      if (currentChunk) {
        messages.push(currentChunk);
      }
      currentChunk = line;
      continue;
    }

    currentChunk = nextChunk;
  }

  if (currentChunk) {
    messages.push(currentChunk);
  }

  return messages;
}

export function buildInternshipMessagesForCategory(
  category: InternshipRequestType,
  store: InternshipStore,
): string[] {
  return buildInternshipMessages(getInternshipsForCategory(category, store));
}
