# AGENTS.md

## Purpose

This file is a working guide for agents and contributors making changes in `glassic-bot`, especially around the internship-fetch flow.

The goal is to keep the internship pipeline easy to change without breaking scheduled refreshes, slash command behavior, or Discord output formatting.

## Project Overview

`glassic-bot` is a TypeScript Discord bot.

Important areas:

- `src/jobs/fetchInternships.ts`
  The internship refresh pipeline. This should own pulling, parsing, normalizing, and updating the in-memory internship store.
- `src/discord/commands/FetchInternships.ts`
  Slash command entry point for reading internship data and posting it to Discord.
- `src/discord/events/client/Ready.ts`
  Startup logic, command registration, and the scheduled internship refresh/post.
- `src/jobs/sendInternshipJobSummary.ts`
  Sends log summaries for the internship job.
- `src/utils/Logger.ts`
  Shared logging behavior used by jobs.

External dependency:

- `../Summer2026-Internships`
  Separate repo whose `README.md` is currently parsed for internship data.

## Required Internship Architecture

Use a single JSON object as the internship store.

That store should:

- live in the bot process as the canonical in-memory cache
- be updated only by the internship refresh job
- be read by slash commands without re-pulling or re-parsing data
- be separated by internship type
- store each internship as structured JSON, not preformatted text

This is the preferred model for the project going forward.

## Required Store Shape

Unless there is a strong reason to change it, use a shape close to this:

```ts
type InternshipType = 'SWE' | 'AI' | 'PM' | 'QUANT' | 'HWE';

type InternshipPosting = {
  company: string;
  jobTitle: string;
  link: string;
};

type InternshipStore = {
  lastUpdatedAt: string | null;
  sourceRepoPath: string;
  sourceReadmePath: string;
  internshipsByType: Record<InternshipType, InternshipPosting[]>;
};
```

Notes:

- `internshipsByType.SWE` should contain every SWE internship currently known after the most recent refresh.
- `internshipsByType.AI` should contain every AI internship currently known after the most recent refresh.
- Repeat the same pattern for `PM`, `QUANT`, and `HWE`.
- `ALL` should not be stored as its own section. It should be derived by combining all typed arrays when needed.

## Expected Flow

The internship flow should work like this:

1. A scheduled job or manual refresh runs `fetchInternships.ts`.
2. The job pulls the external internships repo.
3. The job parses the source README.
4. The job builds a full typed JSON store grouped by internship type.
5. The job updates the shared in-memory store.
6. Scheduled posting reads from that updated store.
7. Slash commands read from that updated store without refreshing contents.

## Rules For Agents

- Treat the internship store as the source of truth for downstream consumers.
- Do not make slash commands call `git pull`, reread the README, or rebuild internship data on demand.
- Keep parsing separate from Discord presentation.
- Prefer a shared formatter/helper for Discord output so command and scheduled posting stay consistent.
- Avoid duplicating category mapping logic across files.
- Preserve logging and error reporting unless intentionally refactoring them.
- Be careful with relative paths like `../Summer2026-Internships`; verify them from the bot root before changing them.

## Safe Refactor Order

For the JSON migration, use this order:

1. Add TypeScript types for the shared internship store.
2. Introduce a module-level in-memory store and accessor helpers.
3. Update `fetchInternships.ts` so it refreshes that store instead of returning presentation-oriented text as the primary artifact.
4. Move Discord text formatting into a shared helper.
5. Update `src/discord/commands/FetchInternships.ts` to read from the store without refreshing.
6. Update `src/discord/events/client/Ready.ts` so the scheduled job refreshes first, then posts from the refreshed store.
7. Remove obsolete text-only assumptions and duplicated formatting logic.

## Testing Checklist

When touching the internship flow, verify:

- `npm run build` succeeds.
- The refresh job updates all categories correctly.
- Slash commands read cached data without triggering a refresh.
- `ALL` combines all category arrays correctly.
- Empty categories are handled cleanly.
- Long Discord responses still chunk safely under message limits.
- Failures in `git pull` or file reads are surfaced and logged.

## Known Risks

- The parser depends on the exact `README.md` structure of another repo.
- `SECTION_HEADERS` is currently mutable global state in `fetchInternships.ts`; that should be removed or localized during refactor.
- Message formatting is currently duplicated in `FetchInternships.ts` and `Ready.ts`.
- Returning presentation-friendly strings from the fetch job makes downstream reuse harder.

## Change Preference

If an agent has to choose between a fast patch and a cleaner typed cache contract, prefer the cleaner typed cache contract as long as the scheduled refresh and slash command behavior remain working in the same change.
