import DiscordClient from '../discord/classes/DiscordClient';
import Logger from '../utils/Logger';
import { CONFIG } from '..';
import sendInternshipJobSummary from './sendInternshipJobSummary';
import path from 'path';
import {
  NEW_GRAD_SECTIONS,
  NewGradStore,
  createEmptyNewGradStore,
  getNewGradStore,
  updateNewGradStore,
} from './newGradStore';
import {
  buildOpportunityGroups,
  writeOpportunityOutputFiles,
} from './opportunityParser';
import { getCachedReadme } from './readmeSource';

const README_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md';
const CACHE_DIR = path.resolve(process.cwd(), 'job-cache/new-grads');
const OUTPUT_DIR = path.resolve(process.cwd(), 'job-output/new-grads');
const SECTION_OUTPUT_PATH = path.join(OUTPUT_DIR, 'section_output.md');
const COMPANIES_OUTPUT_PATH = path.join(OUTPUT_DIR, 'companies_output.md');
const NAME = 'Fetch New Grad Opportunities';

function buildNewGradStore(readmeContent: string, sourceReadmePath: string): {
  store: NewGradStore;
  cleanedTable: string;
} {
  const store = createEmptyNewGradStore(README_URL, sourceReadmePath);
  const { opportunitiesByType, cleanedTable } = buildOpportunityGroups(
    readmeContent,
    NEW_GRAD_SECTIONS,
  );

  store.newGradsByType = opportunitiesByType;
  store.lastUpdatedAt = new Date().toISOString();

  return { store, cleanedTable };
}

const getNewGradOpportunitiesJob =
  (client: DiscordClient) => async () => {
    const whenDone = (log: string, success: boolean) =>
      sendInternshipJobSummary(
        client,
        CONFIG.discord.logs.channel_id,
        NAME,
        log,
      );
    const logger = new Logger(NAME, client, whenDone);

    logger.start();

    try {
      const readme = await getCachedReadme({
        url: README_URL,
        cacheDir: CACHE_DIR,
      });

      if (readme.status === 'stale-cache') {
        logger.warn(readme.message);
      } else {
        logger.info(readme.message);
      }

      const { store, cleanedTable } = buildNewGradStore(
        readme.content,
        readme.cachePath,
      );

      for (const section of NEW_GRAD_SECTIONS) {
        logger.info(
          `Processed ${section.name}: ${store.newGradsByType[section.name].length} new grad roles.`,
        );
      }

      writeOpportunityOutputFiles(
        SECTION_OUTPUT_PATH,
        COMPANIES_OUTPUT_PATH,
        cleanedTable,
        NEW_GRAD_SECTIONS.flatMap((section) => store.newGradsByType[section.name]),
      );
      logger.info(`Section content written to ${SECTION_OUTPUT_PATH}`);
      logger.info(`Companies list written to ${COMPANIES_OUTPUT_PATH}`);

      const updatedStore = updateNewGradStore(store);
      logger.info(
        `Updated new grad store at ${updatedStore.lastUpdatedAt} with ${NEW_GRAD_SECTIONS.flatMap((section) => updatedStore.newGradsByType[section.name]).length} roles.`,
      );
      logger.info(
        `Successfully fetched and processed new grad opportunities.`,
      );
      logger.end();

      return getNewGradStore();
    } catch (error: any) {
      logger.fail(`Error executing job: ${error?.message ?? error}`);
      throw error;
    }
  };

export default getNewGradOpportunitiesJob;
