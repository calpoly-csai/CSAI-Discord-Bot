import {
  InternshipPosting,
  InternshipRequestType,
  InternshipStore,
  getInternshipsForCategory,
} from '../jobs/internshipStore';
import {
  buildOpportunityMessagesWithTitle,
  formatOpportunityPosting,
} from './formatOpportunitiesForDiscord';

export function formatInternshipPosting(posting: InternshipPosting): string {
  return formatOpportunityPosting(posting);
}

export function buildInternshipMessages(postings: InternshipPosting[]): string[] {
  return buildInternshipMessagesWithTitle(postings, `**Here are today's internships:**`);
}

export function buildInternshipMessagesWithTitle(
  postings: InternshipPosting[],
  title: string,
): string[] {
  return buildOpportunityMessagesWithTitle(postings, title);
}

export function buildInternshipMessagesForCategory(
  category: InternshipRequestType,
  store: InternshipStore,
): string[] {
  return buildInternshipMessages(getInternshipsForCategory(category, store));
}
