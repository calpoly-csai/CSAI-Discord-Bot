import DiscordClient from '../discord/classes/DiscordClient';
import Logger from '../utils/Logger';
import { CONFIG } from '..';
import sendInternshipJobSummary from './sendInternshipJobSummary';
import path from 'path';
import {
  INTERNSHIP_SECTIONS,
  InternshipStore,
  createEmptyInternshipStore,
  getInternshipStore,
  updateInternshipStore,
} from './internshipStore';
import {
  buildOpportunityGroups,
  writeOpportunityOutputFiles,
} from './opportunityParser';
import { getCachedReadme } from './readmeSource';

const README_URL =
  'https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md';
const CACHE_DIR = path.resolve(process.cwd(), 'job-cache/internships');
const OUTPUT_DIR = path.resolve(process.cwd(), 'job-output/internships');
const SECTION_OUTPUT_PATH = path.join(OUTPUT_DIR, 'section_output.md');
const COMPANIES_OUTPUT_PATH = path.join(OUTPUT_DIR, 'companies_output.md');
const NAME = 'Fetch Internship Opportunities';

function buildInternshipStore(readmeContent: string, sourceReadmePath: string): {
  store: InternshipStore;
  cleanedTable: string;
} {
  const store = createEmptyInternshipStore(README_URL, sourceReadmePath);
  const { opportunitiesByType, cleanedTable } = buildOpportunityGroups(
    readmeContent,
    INTERNSHIP_SECTIONS,
  );

  store.internshipsByType = opportunitiesByType;
  store.lastUpdatedAt = new Date().toISOString();

  return { store, cleanedTable };
}

const getInternshipOppertunitiesJob =
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

      const { store, cleanedTable } = buildInternshipStore(
        readme.content,
        readme.cachePath,
      );

      for (const section of INTERNSHIP_SECTIONS) {
        logger.info(
          `Processed ${section.name}: ${store.internshipsByType[section.name].length} internships.`,
        );
      }

      writeOpportunityOutputFiles(
        SECTION_OUTPUT_PATH,
        COMPANIES_OUTPUT_PATH,
        cleanedTable,
        INTERNSHIP_SECTIONS.flatMap((section) => store.internshipsByType[section.name]),
      );
      logger.info(`Section content written to ${SECTION_OUTPUT_PATH}`);
      logger.info(`Companies list written to ${COMPANIES_OUTPUT_PATH}`);

      const updatedStore = updateInternshipStore(store);
      logger.info(
        `Updated internship store at ${updatedStore.lastUpdatedAt} with ${INTERNSHIP_SECTIONS.flatMap((section) => updatedStore.internshipsByType[section.name]).length} internships.`,
      );
      logger.info(
        `Successfully fetched and processed internship opportunities.`,
      );
      logger.end();

      return getInternshipStore();
    } catch (error: any) {
      logger.fail(`Error executing job: ${error?.message ?? error}`);
      throw error;
    }
  };

export default getInternshipOppertunitiesJob;
