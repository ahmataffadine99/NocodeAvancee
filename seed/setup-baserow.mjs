// Creates the HelpDesk IA Baserow database (6 tables, fields, relations) and writes
// the API token and table ids into .env. Safe to replay: existing items are kept.
// Usage: BASEROW_EMAIL=... BASEROW_PASSWORD=... node seed/setup-baserow.mjs
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = process.env.BASEROW_ENV_FILE || path.join(root, '.env');

async function loadEnv() {
  let text = '';
  try { text = await readFile(envPath, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
await loadEnv();

const base = (process.env.BASEROW_PUBLIC_URL || 'http://localhost:8081').replace(/\/+$/, '');
const dbName = process.env.BASEROW_DATABASE_NAME || 'HelpDesk IA';
let jwt = process.env.BASEROW_JWT;

async function api(method, url, body, auth = 'JWT') {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(jwt && auth ? { Authorization: `JWT ${jwt}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (res.status === 409 && attempt < 10) { await new Promise((r) => setTimeout(r, 1500)); continue; }
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 300)}`);
    return data;
  }
}

if (!jwt) {
  const { BASEROW_EMAIL: email, BASEROW_PASSWORD: password } = process.env;
  if (!email || !password) throw new Error('Set BASEROW_EMAIL and BASEROW_PASSWORD (your Baserow account).');
  const auth = await api('POST', '/api/user/token-auth/', { email, password }, null);
  jwt = auth.access_token || auth.token;
}

const CATEGORIES = ['hardware', 'access', 'software', 'network', 'onboarding', 'other'];
const colors = ['light-blue', 'light-green', 'light-orange', 'light-red', 'light-purple', 'light-gray', 'light-cyan', 'light-yellow'];
const select = (values) => ({ select_options: values.map((value, i) => ({ value, color: colors[i % colors.length] })) });
const dateTime = { date_format: 'ISO', date_include_time: true, date_time_format: '24' };

// primary: [name, type, extra]; fields created in order; link targets are table names.
const TABLES = [
  { name: 'Collaborators', primary: ['name', 'text'], fields: [
    ['first_name', 'text'], ['email', 'email'], ['team', 'long_text'], ['site', 'text'], ['role', 'text'],
  ] },
  { name: 'Technicians', primary: ['name', 'text'], fields: [
    ['email', 'email'], ['skills', 'multiple_select', select(CATEGORIES)],
    ['open_tickets', 'number', { number_decimal_places: 0, number_negative: false }], ['available', 'boolean'],
  ] },
  { name: 'Tickets', primary: ['reference', 'text'], fields: [
    ['subject', 'text'], ['description', 'long_text'], ['category', 'single_select', select(CATEGORIES)],
    ['priority', 'single_select', select(['P1', 'P2', 'P3', 'P4'])],
    ['status', 'single_select', select(['new', 'triaged', 'assigned', 'pending', 'waiting_approval', 'late', 'closed', 'manual_review'])],
    ['created_at', 'date', dateTime], ['sla_due_at', 'date', dateTime], ['tags', 'multiple_select', select(['manual_review'])],
    ['ai_confidence', 'number', { number_decimal_places: 2, number_negative: false }],
    ['requester', 'link_row', { link: 'Collaborators' }], ['assignee', 'link_row', { link: 'Technicians' }],
  ] },
  { name: 'Replies', primary: ['body', 'long_text'], fields: [
    ['status', 'single_select', select(['draft', 'approved', 'rejected', 'sent'])], ['created_at', 'date', dateTime],
    ['ticket', 'link_row', { link: 'Tickets' }], ['validated_by', 'link_row', { link: 'Collaborators' }],
  ] },
  { name: 'KnowledgeBase', primary: ['title', 'text'], fields: [
    ['category', 'single_select', select(CATEGORIES)], ['content', 'long_text'], ['source', 'text'],
    ['tags', 'multiple_select', select([])], ['updated_at', 'date', dateTime], ['is_active', 'boolean'],
  ] },
  { name: 'AuditLog', primary: ['timestamp', 'date', dateTime], fields: [
    ['action', 'single_select', select(['triaged', 'reply_drafted', 'reply_sent', 'ai_error', 'sla_reminder', 'report_generated'])],
    ['details', 'long_text'], ['outcome', 'text'], ['ticket', 'link_row', { link: 'Tickets' }],
  ] },
];

let workspaces = await api('GET', '/api/workspaces/');
if (!workspaces.length) workspaces = [await api('POST', '/api/workspaces/', { name: 'HelpDesk' })];
const apps = await api('GET', '/api/applications/');
let database = apps.find((a) => a.type === 'database' && a.name === dbName);
if (!database) {
  database = await api('POST', `/api/applications/workspace/${workspaces[0].id}/`, { name: dbName, type: 'database' });
  console.log(`Created database "${dbName}" (${database.id})`);
}
const existingTables = new Map(database.tables?.map((t) => [t.name, t.id]) ?? []);
const ids = {};

for (const spec of TABLES) {
  let id = existingTables.get(spec.name);
  if (!id) {
    const created = await api('POST', `/api/database/tables/database/${database.id}/`, { name: spec.name, data: [[spec.primary[0]]], first_row_header: true });
    id = created.id;
    console.log(`Created table ${spec.name} (${id})`);
  }
  ids[spec.name] = id;
  const fields = await api('GET', `/api/database/fields/table/${id}/`);
  const primary = fields.find((f) => f.primary);
  const [pName, pType, pExtra = {}] = spec.primary;
  if (primary.type !== pType || primary.name !== pName) {
    await api('PATCH', `/api/database/fields/${primary.id}/`, { name: pName, type: pType, ...pExtra });
  }
  const have = new Set(fields.map((f) => f.name));
  for (const [name, type, extra = {}] of spec.fields) {
    if (have.has(name)) continue;
    const { link, ...rest } = extra;
    const body = link ? { name, type, link_row_table_id: ids[link], has_related_field: true } : { name, type, ...rest };
    await api('POST', `/api/database/fields/table/${id}/`, body);
  }
}

let tokenKey = process.env.BASEROW_API_TOKEN;
if (!tokenKey) {
  const token = await api('POST', '/api/database/tokens/', { name: 'HelpDesk n8n', workspace: workspaces[0].id });
  tokenKey = token.key;
  console.log('Created Baserow API token.');
}

const updates = {
  BASEROW_API_TOKEN: tokenKey,
  BASEROW_TABLE_COLLABORATORS_ID: ids.Collaborators,
  BASEROW_TABLE_TECHNICIANS_ID: ids.Technicians,
  BASEROW_TABLE_TICKETS_ID: ids.Tickets,
  BASEROW_TABLE_REPLIES_ID: ids.Replies,
  BASEROW_TABLE_KNOWLEDGEBASE_ID: ids.KnowledgeBase,
  BASEROW_TABLE_AUDITLOG_ID: ids.AuditLog,
};
let env = '';
try { env = await readFile(envPath, 'utf8'); } catch { /* new file */ }
for (const [key, value] of Object.entries(updates)) {
  const line = `${key}=${value}`;
  env = new RegExp(`^${key}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${key}=.*$`, 'm'), line) : `${env.replace(/\s*$/, '\n')}${line}\n`;
}
await writeFile(envPath, env);
console.log('Tables ready:', JSON.stringify(ids));
console.log('.env updated (token and table ids). Next: node seed/seed-baserow.mjs');
