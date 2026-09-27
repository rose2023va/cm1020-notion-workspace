# Case Study: CM1020 Notion Study Workspace

## Title

**A Reproducible Notion Workspace for Six Months of Spaced Study**

## Description

A Notion workspace designed as the long-term memory for a Discrete Mathematics study plan: a session log, a per-topic progress tracker seeded with the ten CM1020 topics, a database of rules to remember, and topic notes. It receives session logs from the DM Study Agent, and it ships with a zero-dependency Node script that rebuilds the entire workspace from JSON schemas in one command.

**Code:** github.com/rose2023va/cm1020-notion-workspace · **Role:** Solo

## Project Scope (Problem)

Preparing for CM1020 meant months of short daily sessions across ten topics. Without a record, three things go wrong:

- **Progress is invisible.** After a few weeks it is hard to say which topics are solid and which only feel familiar.
- **Weak spots repeat.** The same mistakes come back because nothing captures them at the moment they happen.
- **Insights disappear.** Each session ends with one useful rule, and without a place to keep it, it is gone by the next week.

The AI study coach I built solved the practice side. It still needed somewhere durable to write to.

## Constraints

- **Structured enough for an app to write to**, with predictable property names and option values.
- **Simple enough to maintain by hand** on days the app isn't used.
- **Free.** Notion's free plan and its public API.
- **Reproducible.** Other students should be able to create the same workspace without copying mine page by page.

## Approach

**Separate the record from the summary.** Session Log holds every session as it happened. Topic Progress holds one row per topic that gets updated, so the current state of all ten topics is visible on one screen.

**Prefer selects over relations where an app writes.** Topic is a select in all three databases. The app can write a select by name; a relation would need the related page's ID first. Matching option names and colors keep the databases visually connected.

**Make the schema the source of truth.** The databases are defined in JSON files in the exact format the Notion API accepts. A script reads those files, so documentation, rebuild, and structure diagram all come from the same definitions.

## Implementation

- **Session Log:** 10 properties including topic, study mode, duration, a five-level confidence scale ("1 - Lost" to "5 - Nailed it"), what was understood, what needs review, and next action.
- **Topic Progress:** 10 properties, pre-seeded with all ten topics and their prep weeks from the syllabus.
- **Remember This Rules:** rule, topic, explanation, example, common mistake, date added, and review count for weekly review.
- **Study Notes:** a page with one sub-page per topic.
- **Integration:** the DM Study Agent writes a Session Log row and then updates the matching Topic Progress row through a Cloudflare Worker that holds the Notion token.
- **Setup script:** Node 18+, no dependencies. Creates the hub page, three databases, ten seeded rows, and eleven notes pages in 25 API calls, throttled to Notion's rate limit, with a dry-run mode that prints every payload without calling the API. Prints the three database IDs to paste into the study agent.
- **Build record:** documented the difference between the connector's flattened date format and the REST API's nested format, the cause of an early integration error.

## Result

- One place shows every session, every topic's confidence, and every rule, across the whole preparation period.
- The weekly review has a fixed routine: last 7 days of sessions, weakest topic by confidence, unreviewed rules.
- The workspace can be recreated in about two minutes from the repository, so other CM1020 students can use the same system.
- Schema, rebuild script, and structure diagram share one source, so they cannot drift apart.

## Stack

| Layer | Tools |
|---|---|
| Workspace | Notion (databases, select properties, pages) |
| API | Notion API 2022-06-28 |
| Automation | Node.js 18+ (built-in fetch, ES modules), no dependencies |
| Schema | JSON in Notion API property format |
| Integration | Cloudflare Workers proxy, DM Study Agent |
