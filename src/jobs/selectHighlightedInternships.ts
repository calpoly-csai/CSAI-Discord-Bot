import DiscordClient from '../discord/classes/DiscordClient';
import {
  INTERNSHIP_SECTIONS,
  InternshipPosting,
  InternshipStore,
} from './internshipStore';
import { selectHighlightedOpportunities } from './selectHighlightedOpportunities';

export async function selectHighlightedInternships(
  client: DiscordClient,
  store: InternshipStore,
): Promise<InternshipPosting[]> {
  return selectHighlightedOpportunities(
    client,
    INTERNSHIP_SECTIONS,
    store.internshipsByType,
    'internship postings',
    'Internship Highlights',
  );
}
