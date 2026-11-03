import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadLocalEnv() {
  let contents;
  try {
    contents = await readFile(path.join(projectRoot, '.env'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;

    const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
    process.env[match[1]] = value;
  }
}

await loadLocalEnv();

const apiToken = process.env.BASEROW_API_TOKEN?.trim();
const baseUrl = (process.env.BASEROW_PUBLIC_URL || 'http://localhost:8081').replace(/\/+$/, '');
const tableIds = {
  Collaborators: process.env.BASEROW_TABLE_COLLABORATORS_ID || '366',
  Technicians: process.env.BASEROW_TABLE_TECHNICIANS_ID || '367',
  Tickets: process.env.BASEROW_TABLE_TICKETS_ID || '368',
  Replies: process.env.BASEROW_TABLE_REPLIES_ID || '369',
  KnowledgeBase: process.env.BASEROW_TABLE_KNOWLEDGEBASE_ID || '370',
  AuditLog: process.env.BASEROW_TABLE_AUDITLOG_ID || '371',
};

for (const [table, id] of Object.entries(tableIds)) {
  if (!/^\d+$/.test(id)) throw new Error(`Invalid Baserow table ID for ${table}.`);
}

const now = Date.now();
const isoAt = (hoursFromNow) => new Date(now + hoursFromNow * 60 * 60 * 1000).toISOString();
const rowCache = new Map();

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Token ${apiToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const responseText = await response.text();
  let result;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    throw new Error(`Baserow ${method} ${url.pathname} returned non-JSON data (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const detail = typeof result?.detail === 'string' ? result.detail : 'Request failed.';
    throw new Error(`Baserow ${method} ${url.pathname} failed (HTTP ${response.status}): ${detail}`);
  }

  return result;
}

async function getRows(table) {
  if (rowCache.has(table)) return rowCache.get(table);

  const id = tableIds[table];
  const url = new URL(`/api/database/rows/table/${id}/`, baseUrl);
  url.searchParams.set('user_field_names', 'true');
  url.searchParams.set('size', '200');
  url.searchParams.set('page', '1');

  const rows = [];
  let nextUrl = url;
  while (nextUrl) {
    const result = await request('GET', nextUrl);
    if (!Array.isArray(result?.results)) {
      throw new Error(`Baserow returned an unexpected row-list response for ${table}.`);
    }
    rows.push(...result.results);

    if (result.next) {
      const candidate = new URL(result.next, baseUrl);
      if (candidate.origin !== new URL(baseUrl).origin) {
        throw new Error(`Baserow returned a pagination URL outside the configured server for ${table}.`);
      }
      nextUrl = candidate;
    } else {
      nextUrl = null;
    }
  }

  rowCache.set(table, rows);
  return rows;
}

async function ensureRow(table, keyField, values, fieldsToUpdate = []) {
  const rows = await getRows(table);
  const matches = rows.filter((row) => row[keyField] === values[keyField]);
  if (matches.length > 1) {
    throw new Error(`More than one ${table} row matches ${keyField}=${values[keyField]}.`);
  }

  const url = new URL(`/api/database/rows/table/${tableIds[table]}/`, baseUrl);
  url.searchParams.set('user_field_names', 'true');

  if (matches.length === 0) {
    const created = await request('POST', url, values);
    rows.push(created);
    console.info(`Created ${table} seed row (${keyField}=${values[keyField]}).`);
    return created;
  }

  const existing = matches[0];
  const updates = Object.fromEntries(
    fieldsToUpdate
      .filter((field) => existing[field] !== values[field])
      .map((field) => [field, values[field]]),
  );
  if (Object.keys(updates).length === 0) {
    console.info(`Reused ${table} seed row (${keyField}=${values[keyField]}).`);
    return existing;
  }

  const updateUrl = new URL(`${url.pathname}${existing.id}/`, url.origin);
  updateUrl.searchParams.set('user_field_names', 'true');
  const updated = await request('PATCH', updateUrl, updates);
  Object.assign(existing, updated);
  console.info(`Updated ${table} seed row (${keyField}=${values[keyField]}).`);
  return existing;
}

async function seed() {
  if (!apiToken) {
    throw new Error('BASEROW_API_TOKEN is missing. Add it to the ignored local .env file; never commit or share it.');
  }

  const requester = await ensureRow('Collaborators', 'email', {
    name: 'Demo Collaborator',
    first_name: 'Demo',
    email: 'demo.requester@example.test',
    team: 'Demo',
    site: 'Local',
    role: 'Requester',
  });
  const approver = await ensureRow('Collaborators', 'email', {
    name: 'Demo Approver',
    first_name: 'Alex',
    email: 'demo.approver@example.test',
    team: 'Demo',
    site: 'Local',
    role: 'Approver',
  });

  const accessTechnician = await ensureRow('Technicians', 'email', {
    name: 'Demo Technician',
    email: 'demo.technician@example.test',
    skills: ['access'],
    open_tickets: 1,
    available: true,
  }, ['open_tickets']);
  const hardwareTechnician = await ensureRow('Technicians', 'email', {
    name: 'Demo Hardware Technician',
    email: 'demo.hardware@example.test',
    skills: ['hardware'],
    open_tickets: 1,
    available: true,
  }, ['open_tickets']);
  await ensureRow('Technicians', 'email', {
    name: 'Demo Software Technician',
    email: 'demo.software@example.test',
    skills: ['software'],
    open_tickets: 0,
    available: true,
  }, ['open_tickets']);

  const accessTicket = await ensureRow('Tickets', 'reference', {
    reference: 'DEMO-ACCESS-001',
    subject: 'VPN access after password reset',
    description: 'The demo requester cannot reconnect to the company VPN after resetting the password.',
    category: 'access',
    priority: 'P2',
    status: 'assigned',
    requester: [requester.id],
    assignee: [accessTechnician.id],
    created_at: isoAt(-1),
    sla_due_at: isoAt(23),
    tags: [],
    ai_confidence: 0.98,
  });
  const hardwareTicket = await ensureRow('Tickets', 'reference', {
    reference: 'DEMO-HARDWARE-001',
    subject: 'Demo monitor is not detected',
    description: 'The demo workstation does not detect its external monitor after reconnecting the cable.',
    category: 'hardware',
    priority: 'P3',
    status: 'pending',
    requester: [requester.id],
    assignee: [hardwareTechnician.id],
    created_at: isoAt(-48),
    sla_due_at: isoAt(-24),
    tags: [],
    ai_confidence: 0.91,
  });
  const networkTicket = await ensureRow('Tickets', 'reference', {
    reference: 'DEMO-NETWORK-001',
    subject: 'Unclear network connection issue',
    description: 'A demo user reports an intermittent connection issue without enough detail to identify the cause.',
    category: 'network',
    priority: 'P3',
    status: 'manual_review',
    requester: [requester.id],
    assignee: [],
    created_at: isoAt(-0.5),
    sla_due_at: isoAt(7.5),
    tags: ['manual_review'],
    ai_confidence: 0.72,
  });

  await ensureRow('Replies', 'body', {
    body: 'DEMO-REPLY-001: Draft response — please confirm whether the VPN issue continues after signing in again.',
    status: 'draft',
    created_at: isoAt(-0.5),
    ticket: [hardwareTicket.id],
    validated_by: [],
  });
  await ensureRow('Replies', 'body', {
    body: 'DEMO-REPLY-002: Approved example — the VPN profile may need to be refreshed after a password reset.',
    status: 'approved',
    created_at: isoAt(-0.25),
    ticket: [accessTicket.id],
    validated_by: [approver.id],
  });

  await ensureRow('KnowledgeBase', 'title', {
    title: 'DEMO: Refresh VPN access after a password reset',
    category: 'access',
    content: 'Disconnect the VPN client, sign in with the updated account password, and reconnect. If access still fails, ask IT to verify the account.',
    source: 'Fictional seed article',
    tags: [],
    updated_at: isoAt(0),
    is_active: true,
  });
  await ensureRow('KnowledgeBase', 'title', {
    title: 'DEMO: Check an external monitor connection',
    category: 'hardware',
    content: 'Check the monitor power, reseat the video cable, select the correct input, and restart the workstation before escalating.',
    source: 'Fictional seed article',
    tags: [],
    updated_at: isoAt(0),
    is_active: true,
  });
  await ensureRow('KnowledgeBase', 'title', {
    title: 'DEMO: Request a software licence',
    category: 'software',
    content: 'Submit the software name and business justification to IT. Access is granted only after the licence request is approved.',
    source: 'Fictional seed article',
    tags: [],
    updated_at: isoAt(0),
    is_active: true,
  });

  await ensureRow('AuditLog', 'details', {
    timestamp: isoAt(-1),
    action: 'triaged',
    details: 'DEMO-AUDIT-001: {"category":"access","priority":"P2","confidence":0.98,"summary":"VPN access issue classified for a qualified technician."}',
    outcome: 'Fictional seed event; assigned.',
    ticket: [accessTicket.id],
  });
  await ensureRow('AuditLog', 'details', {
    timestamp: isoAt(-48),
    action: 'sla_reminder',
    details: 'DEMO-AUDIT-002: {"category":"hardware","priority":"P3","confidence":0.91,"summary":"Demo ticket with an overdue SLA for W3 testing."}',
    outcome: 'Fictional seed event; reminder scenario.',
    ticket: [hardwareTicket.id],
  });
  await ensureRow('AuditLog', 'details', {
    timestamp: isoAt(-0.5),
    action: 'ai_error',
    details: 'DEMO-AUDIT-003: {"category":"network","priority":"P3","confidence":0.72,"summary":"No qualified demo technician is available; manual review required."}',
    outcome: 'Fictional seed event; ticket left unassigned.',
    ticket: [networkTicket.id],
  });

  console.info('Baserow demo data is ready. No rows were deleted.');
}

await seed();
