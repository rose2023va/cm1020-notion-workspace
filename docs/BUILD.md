# CM1020 Notion Study Workspace: Forensic Build Documentation

**What it is:** A Notion workspace that serves as the long-term memory for a six-month Discrete Mathematics study plan: every session, every topic's confidence, every rule worth remembering, and notes per topic. It is the storage layer behind the DM Study Agent's "Log to Notion" button, and it works on its own too.

**Repository:** https://github.com/rose2023va/cm1020-notion-workspace
**Built:** May 23, 2026 · **Setup script and documentation:** September 27, 2026
**Author:** Rose

---

## 1. Structure

```
CM1020 Discrete Mathematics        hub page: mission, assessment, how to use
├── Session Log                    database, one row per study session
├── Topic Progress                 database, one row per topic (10, pre-seeded)
├── Remember This Rules            database, one row per rule
└── Study Notes                    page
    ├── Topic 01: Sets
    ├── ...
    └── Topic 10: Combinatorics
```

Why these four pieces:

- **Session Log** answers "what did I actually do, and how did it go?" It is the raw record.
- **Topic Progress** answers "where do I stand on each topic?" It is the summary, updated after sessions.
- **Remember This Rules** collects the one-line rule every study session ends with. Reviewing these weekly is the cheapest form of spaced repetition.
- **Study Notes** holds longer explanations worth keeping, one page per topic, so the notes grow into a personal textbook.

---

## 2. Schemas

The source of truth is the `schema/` folder: each file is the exact `properties` object the Notion API accepts.

### Session Log (10 properties)

| Property | Type | Options |
|---|---|---|
| Session | Title | Generated as "Topic - Prompt Type (date)" |
| Date | Date | |
| Topic | Select | Sets, Functions, Propositional Logic, Predicate Logic, Boolean Algebra, Induction & Recursion, Graphs, Trees, Relations, Combinatorics |
| Prompt Type | Select | Daily Refresh, DM Lesson, Morning Review, Progressive Drill, Rescue Mode, Feynman Loop, Cheat Sheet, Lecture Pack, Weekly Review, Math Refresher, Blog Post, Update Tracker |
| Duration (min) | Number | |
| Confidence | Select | 1 - Lost, 2 - Shaky, 3 - Getting it, 4 - Solid, 5 - Nailed it |
| What I Understood | Text | |
| What Needs Review | Text | |
| Next Action | Text | |
| Status | Select | Done, Needs Review, Revisit |

### Topic Progress (10 properties, 10 seeded rows)

| Property | Type | Options |
|---|---|---|
| Topic | Title | One row per CM1020 topic |
| Number | Number | 1 to 10 |
| Status | Select | Not Started, In Progress, Needs Review, Confident, Mastered |
| Confidence | Select | Same five levels as Session Log |
| Sessions Done | Number | |
| Last Studied | Date | |
| Weak Areas | Text | |
| Key Rules Learned | Text | |
| Prep Weeks | Text | "Weeks 1-2" and so on |
| Notes | Text | Topic scope from the syllabus |

Seeded rows: Sets (Weeks 1-2), Functions (3-4), Propositional Logic (5-6), Predicate Logic (7-8), Boolean Algebra (9-10), Induction & Recursion (11-12), Graphs (13-14), Trees (15-16), Relations (17), Combinatorics (18). Week 19 is a full review.

### Remember This Rules (7 properties)

| Property | Type | Options |
|---|---|---|
| Rule | Title | The rule in one line |
| Topic | Select | The 10 topics plus General |
| Explanation | Text | |
| Example | Text | |
| Common Mistake | Text | |
| Date Added | Date | |
| Review Count | Number | Starts at 0 |

**Design choice: selects, not relations.** Topic is a Select in all three databases rather than a relation to Topic Progress. A select can be written by the app with just a name, while a relation would need the related page's ID first. The shared option names and colors keep the three databases visually linked.

**Design choice: confidence labels carry their number.** "3 - Getting it" sorts correctly and still reads naturally.

---

## 3. How the original was built

The workspace was first created on May 23, 2026 from a chat session using Claude's Notion connector, which accepts a SQL-style schema. The original Session Log definition, recorded here as sent:

```sql
CREATE TABLE (
  "Session" TITLE,
  "Date" DATE,
  "Topic" SELECT('Sets':purple, 'Functions':blue, 'Propositional Logic':green,
                 'Predicate Logic':yellow, 'Boolean Algebra':orange,
                 'Induction & Recursion':red, 'Graphs':pink, 'Trees':brown,
                 'Relations':gray, 'Combinatorics':default),
  "Prompt Type" SELECT(...12 options...),
  "Duration (min)" NUMBER,
  "Confidence" SELECT('1 - Lost':red, '2 - Shaky':orange, '3 - Getting it':yellow,
                      '4 - Solid':blue, '5 - Nailed it':green),
  "What I Understood" RICH_TEXT,
  "What Needs Review" RICH_TEXT,
  "Next Action" RICH_TEXT,
  "Status" SELECT('Done':green, 'Needs Review':yellow, 'Revisit':red)
)
```

Topic Progress and Remember This Rules were defined the same way, then the 10 topic rows were inserted and the Study Notes page was created.

The `schema/*.json` files in this repository translate those definitions to the Notion REST API format so anyone can rebuild the workspace without that connector. One difference caught during the build: the connector flattens dates as `date:Date:start`, while the REST API needs `{ "date": { "start": "..." } }`. Mixing the two formats is what caused the DM Study Agent's first Notion 400 error.

---

## 4. Build it yourself

### Option A: setup script (about two minutes)

Requirements: Node 18 or newer. No `npm install`.

1. **Create an integration.** Notion → Settings → Connections → Develop or manage integrations → **New connection** → Access token → select your workspace. Copy the token.
2. **Choose a parent page.** Create or pick any page to hold the workspace. Open it → ••• → **Connections** → add your integration. The script can only write where the integration has been invited.
3. **Copy the page ID.** It is the 32-character string at the end of the page URL.
4. **Preview without writing anything:**
   ```bash
   DRY_RUN=1 PARENT_PAGE_ID=anything node scripts/setup-workspace.mjs
   ```
5. **Run it:**
   ```bash
   NOTION_TOKEN=ntn_your_token PARENT_PAGE_ID=your_page_id node scripts/setup-workspace.mjs
   ```
6. The script prints three database IDs. Paste them into DM Study Agent → Settings → Notion logging.

What the script does, in order (25 API calls):

1. `POST /v1/pages`: the hub page with an intro, assessment weights, and usage notes
2. `POST /v1/databases`: Session Log from `schema/session-log.json`
3. `POST /v1/databases`: Topic Progress from `schema/topic-progress.json`
4. `POST /v1/pages` × 10: one Topic Progress row per entry in `schema/topics.json`
5. `POST /v1/databases`: Remember This Rules from `schema/remember-this-rules.json`
6. `POST /v1/pages`: Study Notes, then × 10 for each topic page

It waits 350 ms between calls to stay under Notion's average rate limit of about three requests per second, and pins `Notion-Version: 2022-06-28` so the payload format stays stable. If a call fails, it stops and reports which step; delete the partial pages before re-running.

### Option B: by hand in Notion

1. Create a page named **CM1020 Discrete Mathematics**.
2. Inside it, type `/database` → **Database - Full page** three times, naming them Session Log, Topic Progress, and Remember This Rules.
3. Add the properties from Section 2 to each database. Rename the default Name column to the title property listed (Session, Topic, Rule). Match select option names exactly: the DM Study Agent writes them as text and Notion creates a new option on any mismatch.
4. Add the 10 rows to Topic Progress.
5. Create a **Study Notes** page with 10 sub-pages.
6. Share the hub page with your integration (••• → Connections).

To find a database ID: open the database as a full page, copy its link, and take the 32 characters before `?v=`.

---

## 5. How the DM Study Agent writes to it

The app never talks to Notion directly. It calls a Cloudflare Worker (see the `dm-study-agent` repository, `worker/`) that holds the token.

**On "Save to Notion" in the app:**

1. Creates a Session Log row. Form fields map to properties:

| Form field | Property |
|---|---|
| Topic | Topic (select) |
| Session Type | Prompt Type (select) |
| Duration | Duration (min) |
| Confidence | Confidence (select) |
| What I Understood | What I Understood |
| Needs Review | What Needs Review |
| Next Action | Next Action |
| (automatic) | Session title, Date = today, Status = Done |

2. Queries Topic Progress for the row whose title equals the topic, then updates Confidence, Status (In Progress), Weak Areas (from Needs Review), and Last Studied (today).

---

## 6. Weekly workflow

- **Daily:** study, then log the session. Add the session's "Remember this" rule to the rules database.
- **Saturday:** filter Session Log to the last 7 days; sort Topic Progress by Confidence ascending to find the weakest topic; review every rule with Review Count 0 and increment it.
- **When a topic feels solid:** set its Status to Confident or Mastered. Keep reviewing its rules anyway.

Useful views to add: Session Log grouped by Topic; Session Log as a calendar on Date; Remember This Rules grouped by Topic and sorted by Review Count.

---

## 7. Known limitations

- Sessions Done on Topic Progress is not incremented automatically; update it during the weekly review or add a Rollup if you convert Topic to a relation.
- Remember This Rules is filled by hand; the app has the function but no button yet.
- Study Notes pages start with only the topic scope.
- The script creates a new workspace each run; it does not update an existing one.
- Notion's newer API versions model databases as data sources. The script pins 2022-06-28, which Notion continues to serve; moving to a newer version would require changing the create-database payload.

---

## 8. Repository map

```
schema/session-log.json           Session Log properties
schema/topic-progress.json        Topic Progress properties
schema/remember-this-rules.json   Remember This Rules properties
schema/topics.json                The 10 topics used for seeding
scripts/setup-workspace.mjs       One-command builder (Node 18+, no dependencies)
screenshots/workspace-structure.png
```
