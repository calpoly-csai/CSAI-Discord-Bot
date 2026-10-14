import { OpportunityPosting } from '../jobs/opportunityParser';

const DISCORD_MESSAGE_LIMIT = 1900;

export function formatOpportunityPosting(posting: OpportunityPosting): string {
  return `${posting.company}: [${posting.jobTitle}](<${posting.link}>)`;
}

export function buildOpportunityMessagesWithTitle(
  postings: OpportunityPosting[],
  title: string,
): string[] {
  if (postings.length === 0) {
    return [];
  }

  const lines = postings.map(formatOpportunityPosting);
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
