import DiscordClient from '../discord/classes/DiscordClient';
import {
  NEW_GRAD_SECTIONS,
  NewGradPosting,
  NewGradStore,
} from './newGradStore';
import { selectHighlightedOpportunities } from './selectHighlightedOpportunities';

export async function selectHighlightedNewGrads(
  client: DiscordClient,
  store: NewGradStore,
): Promise<NewGradPosting[]> {
  return selectHighlightedOpportunities(
    client,
    NEW_GRAD_SECTIONS,
    store.newGradsByType,
    'new grad role postings',
    'New Grad Highlights',
  );
}
