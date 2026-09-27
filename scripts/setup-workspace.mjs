#!/usr/bin/env node
/**
 * Rebuilds the CM1020 Discrete Mathematics study workspace in Notion.
 *
 * Creates, under a parent page you choose:
 *   CM1020 Discrete Mathematics (hub page)
 *     Session Log            (database)
 *     Topic Progress         (database, seeded with the 10 CM1020 topics)
 *     Remember This Rules    (database)
 *     Study Notes            (page with one sub-page per topic)
 *
 * Requirements: Node 18+ (uses the built-in fetch). No npm install.
 *
 * Usage:
 *   NOTION_TOKEN=ntn_xxx PARENT_PAGE_ID=xxxxxxxx node scripts/setup-workspace.mjs
 *   DRY_RUN=1 PARENT_PAGE_ID=test node scripts/setup-workspace.mjs   (prints payloads, calls nothing)
 *
 * The parent page must be shared with your integration first:
 *   open the page in Notion > ... menu > Connections > add your integration.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const NOTION_VERSION = '2022-06-28';
const TOKEN = process.env.NOTION_TOKEN;
const PARENT = (process.env.PARENT_PAGE_ID || '').replace(/-/g, '');
const DRY_RUN = process.env.DRY_RUN === '1';

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaDir = path.join(here, '..', 'schema');
const loadJson = async name => JSON.parse(await readFile(path.join(schemaDir, name), 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!PARENT || (!TOKEN && !DRY_RUN)) {
  console.error('Set NOTION_TOKEN and PARENT_PAGE_ID. See the usage notes at the top of this file.');
  process.exit(1);
}

let fakeId = 0;
async function notion(method, endpoint, body) {
  if (DRY_RUN) {
    console.log(`\n${method} ${endpoint}\n${JSON.stringify(body, null, 2)}`);
    fakeId += 1;
    return { id: `dry-run-${fakeId}`, url: `https://notion.so/dry-run-${fakeId}` };
  }
  const res = await fetch(`https://api.notion.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${endpoint} failed (${res.status}): ${data.message}`);
  await sleep(350); // stay under Notion's ~3 requests/second average
  return data;
}

const text = content => [{ type: 'text', text: { content } }];
const para = content => ({ object: 'block', type: 'paragraph', paragraph: { rich_text: text(content) } });
const h2 = content => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: text(content) } });
const bullet = content => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: text(content) } });

async function createPage(parentPageId, title, icon, children = []) {
  return notion('POST', '/v1/pages', {
    parent: { type: 'page_id', page_id: parentPageId },
    icon: { type: 'emoji', emoji: icon },
    properties: { title: { title: text(title) } },
    children
  });
}

async function createDatabase(parentPageId, schema) {
  return notion('POST', '/v1/databases', {
    parent: { type: 'page_id', page_id: parentPageId },
    icon: { type: 'emoji', emoji: schema.icon },
    title: text(schema.title),
    description: text(schema.description),
    properties: schema.properties
  });
}

async function main() {
  const [sessionLog, topicProgress, rules, topics] = await Promise.all([
    loadJson('session-log.json'),
    loadJson('topic-progress.json'),
    loadJson('remember-this-rules.json'),
    loadJson('topics.json')
  ]);

  console.log('1/5 Creating hub page');
  const hub = await createPage(PARENT, 'CM1020 Discrete Mathematics', '🧮', [
    para('Central study hub for University of London CM1020 Discrete Mathematics: session logs, topic progress, study notes, and accumulated Remember This rules.'),
    h2('Assessment'),
    bullet('20%: end-of-week quizzes for Topics 1 to 5 (weeks 1 to 12)'),
    bullet('30%: written, staff-graded coursework (week 12)'),
    bullet('50%: written examination (week 22)'),
    h2('How to use this workspace'),
    bullet('Log every study session in Session Log (the DM Study Agent can do this for you).'),
    bullet('Update Topic Progress when your confidence changes.'),
    bullet('Save each end-of-session rule in Remember This Rules and review them weekly.')
  ]);

  console.log('2/5 Creating Session Log database');
  const sessionDb = await createDatabase(hub.id, sessionLog);

  console.log('3/5 Creating Topic Progress database and seeding 10 topics');
  const progressDb = await createDatabase(hub.id, topicProgress);
  for (const t of topics) {
    await notion('POST', '/v1/pages', {
      parent: { type: 'database_id', database_id: progressDb.id },
      properties: {
        'Topic': { title: text(t.name) },
        'Number': { number: t.number },
        'Status': { select: { name: 'Not Started' } },
        'Sessions Done': { number: 0 },
        'Prep Weeks': { rich_text: text(t.weeks) },
        'Notes': { rich_text: text(t.notes) }
      }
    });
  }

  console.log('4/5 Creating Remember This Rules database');
  const rulesDb = await createDatabase(hub.id, rules);

  console.log('5/5 Creating Study Notes with one page per topic');
  const notes = await createPage(hub.id, 'Study Notes', '📚', [
    para('One sub-page per topic. After each session, paste the key notes into the matching topic page. Over the module this becomes your own DM textbook.')
  ]);
  for (const t of topics) {
    const n = String(t.number).padStart(2, '0');
    await createPage(notes.id, `Topic ${n}: ${t.name}`, '📄', [para(t.notes)]);
  }

  console.log('\nDone. Paste these into DM Study Agent > Settings > Notion logging:');
  console.log(`  Session Log database ID:         ${sessionDb.id}`);
  console.log(`  Topic Progress database ID:      ${progressDb.id}`);
  console.log(`  Remember This Rules database ID: ${rulesDb.id}`);
  console.log(`\nHub page: ${hub.url}`);
}

main().catch(err => {
  console.error(`\nSetup stopped: ${err.message}`);
  console.error('Pages created before the error remain in Notion. Delete them before re-running.');
  process.exit(1);
});
