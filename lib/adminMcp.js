import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { kampalaDateKey } from './clientDataContract.js';

export const TOP_ADMIN_EMAIL = 'alphacortexai@gmail.com';
export const ADMIN_MCP_SCOPE = 'spagym.admin.read';
export const KAMPALA_TIME_ZONE = 'Africa/Kampala';
export const CHECK_IN_MAX_DAYS = 92;
export const REPORT_MAX_DAYS = 92;
export const BIRTHDAY_MAX_DAYS = 366;
export const FEEDBACK_RESULT_LIMIT = 400;
export const CHECK_IN_RESULT_LIMIT = 500;
export const BIRTHDAY_RESULT_LIMIT = 500;
export const REPORT_RESULT_LIMIT = 80;
export const SUPPORTED_PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const REASON_LABELS = [
  '"reason for call : reactivation of inactive spa client"',
  '"reason for call : reactivation of inactive gym client"',
  '"reason for call : recent visit feedback"',
  'reactivation of in active client',
  'reactivation of inactive gym client',
  'reactivation of inactive spa client',
  'recent visit feedback',
];
const CONCERN_PHRASES = [
  'not happy',
  'not satisfied',
  'no one',
  'nobody',
  'follow up',
  'follow-up',
  'call me',
  'please call',
  'did not',
  "didn't",
  'never again',
  'not working',
  'hung up',
  'overcharged',
  'too expensive',
  'poor service',
  'bad service',
  'waste of',
  'still waiting',
  'no response',
  'wrong treatment',
  'wrong service',
];
const CONCERN_WORDS = [
  'complaint',
  'complain',
  'complained',
  'unhappy',
  'disappointed',
  'disappointing',
  'rude',
  'delay',
  'delayed',
  'late',
  'wrong',
  'incorrect',
  'mistake',
  'issue',
  'problem',
  'refund',
  'dirty',
  'terrible',
  'awful',
  'worst',
  'upset',
  'angry',
  'allergic',
  'ignored',
  'unprofessional',
  'broken',
  'cancel',
  'cancelled',
  'canceled',
  'dissatisfied',
  'unacceptable',
  'disgusting',
  'unresolved',
  'pain',
  'hurt',
];

const REPORT_SECTIONS = [
  ['birthdayClients', 'Birthday clients contacted'],
  ['previousDayVisits', 'Previous-day visits, calls, and WhatsApp'],
  ['followUps', 'Follow-ups'],
  ['whatsappMessages', 'WhatsApp messages'],
];

const dateSchema = {
  type: 'string',
  description: 'Calendar date in Africa/Kampala, YYYY-MM-DD. Omit date, from, and to to use today.',
};
const rangeSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    date: dateSchema,
    from: { ...dateSchema, description: 'Range start, YYYY-MM-DD in Africa/Kampala. Use with to.' },
    to: { ...dateSchema, description: 'Range end, YYYY-MM-DD in Africa/Kampala. Use with from.' },
  },
};

export class McpToolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'McpToolError';
  }
}

export const ADMIN_MCP_TOOLS = [
  {
    name: 'list_branches',
    description: 'List the spa and gym branches that can filter the other admin tools. Call this before filtering by branch.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'list_wrong_feedback',
    description: 'Pull client feedback that looks wrong, negative, or in need of follow-up from caller reports. Covers one Africa/Kampala day or a range of up to 92 days, for every branch or for branch names returned by list_branches. Each item includes the report date, branch, caller, client, phone, section, the recorded comment, and the words that caused it to be flagged. This is a reading aid for the top administrator, not a guarantee. Set includeRoutine to true to also return ordinary comments from the same reports.',
    inputSchema: {
      ...rangeSchema,
      properties: {
        ...rangeSchema.properties,
        branches: {
          description: 'Branch names from list_branches. Omit for every branch. A single branch name is also accepted.',
          anyOf: [
            { type: 'string' },
            { type: 'array', items: { type: 'string' }, maxItems: 30 },
          ],
        },
        includeRoutine: {
          type: 'boolean',
          description: 'When true, include comments that were not flagged. Defaults to false.',
        },
      },
    },
  },
  {
    name: 'list_birthdays',
    description: 'List birthday babies for today, or birthdays on any Africa/Kampala day or date range up to 366 days. Matching uses the stored birthday month and day. The birth year is not stored. Optional branch name from list_branches.',
    inputSchema: {
      ...rangeSchema,
      properties: {
        ...rangeSchema.properties,
        branch: { type: 'string', description: 'Optional branch name from list_branches.' },
      },
    },
  },
  {
    name: 'lookup_client',
    description: 'Look up client details by phone number or by name. Provide phone or name, not both. Returns the matching name, phone numbers, birthday month and day, and branch.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        phone: { type: 'string', description: 'Phone number to look up.' },
        name: { type: 'string', description: 'At least two characters of the client name.' },
        limit: { type: 'integer', minimum: 1, maximum: 25, description: 'Maximum matches. Defaults to 10.' },
      },
    },
  },
  {
    name: 'list_check_ins',
    description: 'Show who checked in and when, for today or any Africa/Kampala period of up to 92 days. Optional branch name. Set openOnly to true for people still checked in. Times are returned in UTC and as Africa/Kampala local time. A visit still open after 12 hours is reported as checked out by the automatic timeout.',
    inputSchema: {
      ...rangeSchema,
      properties: {
        ...rangeSchema.properties,
        branch: { type: 'string', description: 'Optional branch name from list_branches.' },
        openOnly: { type: 'boolean', description: 'When true, return only people who are still checked in.' },
      },
    },
  },
  {
    name: 'list_caller_reports',
    description: 'Show which callers made reports for one day or a range of up to 92 days, and the details recorded in those reports. Includes birthday contacts, previous-day visit calls and WhatsApp messages, follow-ups, comments, and whether each comment looks like concerning feedback. Optional branch and caller name.',
    inputSchema: {
      ...rangeSchema,
      properties: {
        ...rangeSchema.properties,
        branch: { type: 'string', description: 'Optional branch name from list_branches.' },
        caller: { type: 'string', description: 'Optional caller name, matched as part of the recorded caller or owner name.' },
      },
    },
  },
  {
    name: 'count_clients',
    description: 'Return how many client profiles are stored in the system. With no branch, returns the total, a count for every branch, and how many profiles are on another or blank branch. With a branch, returns that branch count and the system total.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        branch: { type: 'string', description: 'Optional branch name from list_branches.' },
      },
    },
  },
];

const INSTRUCTIONS = [
  'Read-only SpaGym tools for the top administrator.',
  'Dates are calendar dates in Africa/Kampala, formatted YYYY-MM-DD. Omit dates to use today.',
  'Call list_branches before filtering another tool by branch, and pass those branch names.',
  'Use list_wrong_feedback for complaints and other feedback that may need follow-up.',
  'Use list_caller_reports to see who filed a report and every detail recorded in it, including feedback.',
  'Use list_birthdays with no dates for birthday babies today.',
  'Use list_check_ins for who checked in and when. Use openOnly for people still on site.',
  'Use lookup_client for one client by phone or name, and count_clients for how many clients are stored.',
  'Do not invent clients, visits, or feedback that these tools did not return.',
].join(' ');

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clip(value, max) {
  const text = clean(value);
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true };
}

function flag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function isRealDate(value) {
  if (!DATE_KEY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function eachDate(from, to) {
  const dates = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function parseAdminDateWindow(input = {}, now = new Date(), maxDays = REPORT_MAX_DAYS) {
  const date = clean(input.date);
  const fromInput = clean(input.from);
  const toInput = clean(input.to);
  if (date && (fromInput || toInput)) throw new McpToolError('Use either date, or from and to, not both.');
  if ((fromInput && !toInput) || (!fromInput && toInput)) throw new McpToolError('Provide both from and to.');
  if (!date && !fromInput && !toInput) {
    const today = kampalaDateKey(now);
    return { from: today, to: today, dates: [today], timezone: KAMPALA_TIME_ZONE };
  }
  const from = date || fromInput;
  const to = date || toInput;
  if (!isRealDate(from) || !isRealDate(to)) throw new McpToolError('Dates must be real calendar dates in YYYY-MM-DD format.');
  if (from > to) throw new McpToolError('from must be on or before to.');
  const dates = eachDate(from, to);
  if (dates.length > maxDays) {
    throw new McpToolError(`That period is ${dates.length} days. Ask for at most ${maxDays} days at a time.`);
  }
  return { from, to, dates, timezone: KAMPALA_TIME_ZONE };
}

export function monthsInWindow(dates) {
  return [...new Set(dates.map((date) => Number(date.slice(5, 7))))];
}

function branchList(known) {
  return (Array.isArray(known) ? known : [])
    .map((branch) => ({
      id: String(branch?.id || ''),
      name: clean(branch?.name || branch),
    }))
    .filter((branch) => branch.name);
}

export function resolveBranchNames(requested, known) {
  const available = branchList(known);
  const wanted = (Array.isArray(requested) ? requested : requested ? [requested] : [])
    .map((name) => clean(name))
    .filter(Boolean);
  if (wanted.length > 30) throw new McpToolError('Filter by at most 30 branches.');
  if (!wanted.length) return [];
  const resolved = [];
  const unknown = [];
  for (const name of wanted) {
    const match = available.find((branch) => branch.name.toLowerCase() === name.toLowerCase());
    if (!match) unknown.push(name);
    else if (!resolved.includes(match.name)) resolved.push(match.name);
  }
  if (unknown.length) {
    const names = available.map((branch) => branch.name).join(', ') || 'none';
    throw new McpToolError(`Unknown branch: ${unknown.join(', ')}. Available branches: ${names}.`);
  }
  return resolved;
}

export function resolveBranchName(requested, known) {
  const names = resolveBranchNames(requested ? [requested] : [], known);
  return names[0] || '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function substantiveFeedback(text) {
  let value = String(text || '');
  for (const label of REASON_LABELS) {
    value = value.replace(new RegExp(escapeRegExp(label), 'ig'), ' ');
  }
  return value.replace(/\s+/g, ' ').trim();
}

export function concernSignals(text) {
  const haystack = substantiveFeedback(text)
    .toLowerCase()
    .replace(/\b(nothing wrong|no problem|no issue|no complaint)\b/g, ' ');
  if (!haystack.trim()) return [];
  const signals = [];
  for (const phrase of CONCERN_PHRASES) {
    if (haystack.includes(phrase)) signals.push(phrase);
  }
  for (const word of CONCERN_WORDS) {
    if (new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(haystack)) signals.push(word);
  }
  return [...new Set(signals)];
}

function customText(row = {}) {
  return Object.values(row.customFields || {})
    .map((value) => clean(typeof value === 'string' ? value : ''))
    .filter(Boolean)
    .join('\n');
}

function rowComment(row = {}) {
  return clean(row.comment) || clean(row.feedback) || clean(row.birthdayFeedback) || customText(row);
}

function reportCaller(report = {}) {
  return clean(report.callerName) || clean(report.ownerName) || 'Caller not recorded';
}

function reportDate(report = {}) {
  return clean(report.reportDateKey) || clean(report.reportDate).slice(0, 10);
}

function customFields(row = {}) {
  const source = row.customFields && typeof row.customFields === 'object' ? row.customFields : {};
  const fields = {};
  for (const [key, value] of Object.entries(source)) {
    const name = clean(key).slice(0, 80);
    const recorded = clip(typeof value === 'string' ? value : '', 1000);
    if (!name || !recorded.text) continue;
    fields[name] = recorded.text;
  }
  return fields;
}

function presentRow(row = {}, index = 0) {
  const comment = clip(rowComment(row), 4000);
  const signals = concernSignals([comment.text, customText(row)].filter(Boolean).join('\n'));
  return {
    row: index + 1,
    clientName: clean(row.clientName) || clean(row.name),
    phoneNumber: clean(row.phoneNumber) || clean(row.phone),
    branch: clean(row.branch),
    contactMethod: clean(row.contactMethod),
    callerName: clean(row.callerName),
    comment: comment.text,
    commentTruncated: comment.truncated,
    concerning: signals.length > 0,
    concernSignals: signals,
    customFields: customFields(row),
  };
}

function rowHasDetail(row) {
  return Boolean(row.clientName || row.phoneNumber || row.comment || row.contactMethod || Object.keys(row.customFields).length);
}

export function presentWrongFeedback(reports, { branches = [], includeRoutine = false, limit = FEEDBACK_RESULT_LIMIT } = {}) {
  const wanted = new Set(branches.map((branch) => branch.toLowerCase()));
  const feedback = [];
  for (const report of reports) {
    for (const [field, section] of REPORT_SECTIONS) {
      const rows = Array.isArray(report[field]) ? report[field] : [];
      rows.forEach((row, index) => {
        const presented = presentRow(row, index);
        if (!presented.comment) return;
        const branch = presented.branch || clean(report.branch);
        if (wanted.size && !wanted.has(branch.toLowerCase())) return;
        if (!includeRoutine && !presented.concerning) return;
        feedback.push({
          reportDate: reportDate(report),
          branch,
          callerName: presented.callerName || reportCaller(report),
          section,
          clientName: presented.clientName,
          phoneNumber: presented.phoneNumber,
          contactMethod: presented.contactMethod,
          comment: presented.comment,
          commentTruncated: presented.commentTruncated,
          concerning: presented.concerning,
          concernSignals: presented.concernSignals,
        });
      });
    }
  }
  feedback.sort((left, right) => String(right.reportDate).localeCompare(String(left.reportDate))
    || left.branch.localeCompare(right.branch)
    || left.callerName.localeCompare(right.callerName));
  return {
    matched: feedback.length,
    truncated: feedback.length > limit,
    feedback: feedback.slice(0, limit),
  };
}

export function presentCallerReports(reports, { branch = '', caller = '', limit = REPORT_RESULT_LIMIT } = {}) {
  const callerQuery = caller.toLowerCase();
  const filtered = reports.filter((report) => {
    if (branch && clean(report.branch).toLowerCase() !== branch.toLowerCase()) return false;
    if (!callerQuery) return true;
    return `${reportCaller(report)} ${clean(report.ownerName)}`.toLowerCase().includes(callerQuery);
  });
  filtered.sort((left, right) => reportDate(right).localeCompare(reportDate(left)) || reportCaller(left).localeCompare(reportCaller(right)));
  const presented = filtered.slice(0, limit).map((report) => {
    const sections = REPORT_SECTIONS.map(([field, name]) => {
      const rows = (Array.isArray(report[field]) ? report[field] : [])
        .map((row, index) => presentRow(row, index))
        .filter(rowHasDetail)
        .slice(0, 150);
      return { name, count: rows.length, rows };
    }).filter((section) => section.count);
    const feedback = sections.flatMap((section) => section.rows.filter((row) => row.comment).map((row) => ({
      section: section.name,
      clientName: row.clientName,
      phoneNumber: row.phoneNumber,
      comment: row.comment,
      concerning: row.concerning,
      concernSignals: row.concernSignals,
    })));
    const notes = clip(report.notes, 2000);
    return {
      reportDate: reportDate(report),
      callerName: reportCaller(report),
      ownerName: clean(report.ownerName),
      branch: clean(report.branch),
      notes: notes.text,
      notesTruncated: notes.truncated,
      updatedAt: clean(report.updatedAt) || null,
      sections,
      feedback,
    };
  });
  const callers = [...new Set(filtered.map(reportCaller))].sort((left, right) => left.localeCompare(right));
  return {
    matched: filtered.length,
    truncated: filtered.length > limit,
    callers,
    reports: presented,
  };
}

function birthdayLabel(month, day) {
  const date = new Date(Date.UTC(2000, month - 1, day));
  return new Intl.DateTimeFormat('en-GB', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function validBirthday(month, day) {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12) return false;
  const probe = new Date(Date.UTC(2000, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function presentBirthdays(clients, window, branch = '', limit = BIRTHDAY_RESULT_LIMIT) {
  const byId = new Map();
  for (const client of clients) {
    if (client?.id && !byId.has(client.id)) byId.set(client.id, client);
  }
  const birthdays = [];
  for (const client of byId.values()) {
    const month = Number(client.birthMonth);
    const day = Number(client.birthDay);
    if (!validBirthday(month, day)) continue;
    const clientBranch = clean(client.branch);
    if (branch && clientBranch.toLowerCase() !== branch.toLowerCase()) continue;
    const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const occursOn = window.dates.filter((date) => date.slice(5) === monthDay);
    if (!occursOn.length) continue;
    birthdays.push({
      id: String(client.id),
      name: clean(client.name),
      phoneNumber: clean(client.phoneNumber),
      branch: clientBranch,
      birthMonth: month,
      birthDay: day,
      birthday: birthdayLabel(month, day),
      occursOn,
    });
  }
  birthdays.sort((left, right) => left.occursOn[0].localeCompare(right.occursOn[0]) || left.name.localeCompare(right.name));
  return {
    matched: birthdays.length,
    truncated: birthdays.length > limit,
    birthdays: birthdays.slice(0, limit),
  };
}

export function formatKampala(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: KAMPALA_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)} EAT`;
}

export function presentCheckIns(visits, { branch = '', openOnly = false, limit = CHECK_IN_RESULT_LIMIT } = {}) {
  let rows = Array.isArray(visits) ? visits : [];
  if (branch) rows = rows.filter((visit) => clean(visit.branch).toLowerCase() === branch.toLowerCase());
  if (openOnly) rows = rows.filter((visit) => visit.status === 'checked-in');
  rows = [...rows].sort((left, right) => String(right.checkedInAt || '').localeCompare(String(left.checkedInAt || '')));
  const checkIns = rows.slice(0, limit).map((visit) => ({
    id: String(visit.id || ''),
    clientId: clean(visit.clientId),
    name: clean(visit.name) || clean(visit.clientName),
    phoneNumber: clean(visit.phoneNumber),
    branch: clean(visit.branch),
    visitDate: clean(visit.visitDate),
    status: visit.status === 'checked-in' ? 'checked-in' : 'checked-out',
    checkedInAt: visit.checkedInAt || null,
    checkedInAtKampala: formatKampala(visit.checkedInAt),
    checkedOutAt: visit.checkedOutAt || null,
    checkedOutAtKampala: formatKampala(visit.checkedOutAt),
    checkedOutBy: clean(visit.checkedOutBy),
  }));
  return { matched: rows.length, truncated: rows.length > limit, openOnly: Boolean(openOnly), checkIns };
}

export function presentClientCount({ total = 0, byBranch = [] } = {}, branch = '') {
  const branches = byBranch
    .map((entry) => ({ branch: clean(entry.branch), count: Number(entry.count) || 0 }))
    .sort((left, right) => left.branch.localeCompare(right.branch));
  if (branch) {
    const selected = branches.find((entry) => entry.branch.toLowerCase() === branch.toLowerCase());
    return { total: Number(total) || 0, branch, branchCount: selected?.count || 0 };
  }
  const assigned = branches.reduce((sum, entry) => sum + entry.count, 0);
  return {
    total: Number(total) || 0,
    byBranch: branches,
    otherOrUnassigned: (Number(total) || 0) - assigned,
  };
}

function wholeLimit(value, fallback, max) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new McpToolError('limit must be a whole number of at least 1.');
  return Math.min(parsed, max);
}

async function knownBranches(data) {
  const branches = await data.listBranches();
  return branchList(branches);
}

function windowSummary(window) {
  return { from: window.from, to: window.to, days: window.dates.length, timezone: window.timezone };
}

export async function dispatchTool(name, rawArgs, data, now = new Date()) {
  if (!ADMIN_MCP_TOOLS.some((tool) => tool.name === name)) throw new McpToolError(`Unknown tool: ${name}.`);
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) throw new McpToolError('Tool arguments must be an object.');
  if (name === 'list_branches') {
    const branches = await knownBranches(data);
    return { count: branches.length, branches };
  }

  if (name === 'count_clients') {
    const branches = await knownBranches(data);
    const branch = resolveBranchName(rawArgs.branch, branches);
    const counts = await data.countClients(branches.map((item) => item.name));
    return presentClientCount(counts, branch);
  }

  if (name === 'lookup_client') {
    const phone = clean(rawArgs.phone);
    const search = clean(rawArgs.name);
    if (phone && search) throw new McpToolError('Provide either phone or name, not both.');
    if (!phone && search.length < 2) throw new McpToolError('Provide a phone number or at least two characters of a name.');
    const limit = wholeLimit(rawArgs.limit, 10, 25);
    const clients = await data.lookupClients({ phone, name: search, limit });
    return { matched: clients.length, clients };
  }

  const branches = await knownBranches(data);
  if (name === 'list_wrong_feedback') {
    const window = parseAdminDateWindow(rawArgs, now, REPORT_MAX_DAYS);
    const selected = resolveBranchNames(rawArgs.branches, branches);
    const reports = await data.loadReports(window);
    return {
      ...windowSummary(window),
      branches: selected,
      includeRoutine: flag(rawArgs.includeRoutine),
      ...presentWrongFeedback(reports, { branches: selected, includeRoutine: flag(rawArgs.includeRoutine) }),
    };
  }
  if (name === 'list_birthdays') {
    const window = parseAdminDateWindow(rawArgs, now, BIRTHDAY_MAX_DAYS);
    const branch = resolveBranchName(rawArgs.branch, branches);
    const clients = await data.loadBirthdayClients(monthsInWindow(window.dates));
    return { ...windowSummary(window), branch: branch || null, ...presentBirthdays(clients, window, branch) };
  }
  if (name === 'list_check_ins') {
    const window = parseAdminDateWindow(rawArgs, now, CHECK_IN_MAX_DAYS);
    const branch = resolveBranchName(rawArgs.branch, branches);
    const visits = await data.loadVisits(window.dates);
    return {
      ...windowSummary(window),
      branch: branch || null,
      ...presentCheckIns(visits, { branch, openOnly: flag(rawArgs.openOnly) }),
    };
  }
  if (name === 'list_caller_reports') {
    const window = parseAdminDateWindow(rawArgs, now, REPORT_MAX_DAYS);
    const branch = resolveBranchName(rawArgs.branch, branches);
    const caller = clean(rawArgs.caller).slice(0, 120);
    const reports = await data.loadReports(window);
    return { ...windowSummary(window), branch: branch || null, caller: caller || null, ...presentCallerReports(reports, { branch, caller }) };
  }
  throw new McpToolError(`Unknown tool: ${name}.`);
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function negotiateProtocol(version) {
  return SUPPORTED_PROTOCOL_VERSIONS.includes(version) ? version : '2025-03-26';
}

export function initializeResult(params = {}) {
  return {
    protocolVersion: negotiateProtocol(params?.protocolVersion),
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'spagym-admin', version: '1.0.0' },
    instructions: INSTRUCTIONS,
  };
}

function toolResult(payload, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError,
  };
}

export async function handleMcpMessage(message, data, now = new Date()) {
  if (Array.isArray(message)) return { status: 400, body: rpcError(null, -32600, 'Batch requests are not supported.') };
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return { status: 400, body: rpcError(message?.id ?? null, -32600, 'Invalid Request') };
  }
  const { id, method, params } = message;
  if (id === undefined || method.startsWith('notifications/')) return { notification: true };
  try {
    if (method === 'initialize') return { status: 200, body: rpcResult(id, initializeResult(params)) };
    if (method === 'ping' || method === 'logging/setLevel') return { status: 200, body: rpcResult(id, {}) };
    if (method === 'tools/list') return { status: 200, body: rpcResult(id, { tools: ADMIN_MCP_TOOLS }) };
    if (method === 'resources/list') return { status: 200, body: rpcResult(id, { resources: [] }) };
    if (method === 'prompts/list') return { status: 200, body: rpcResult(id, { prompts: [] }) };
    if (method === 'tools/call') {
      try {
        const payload = await dispatchTool(params?.name, params?.arguments || {}, data, now);
        return { status: 200, body: rpcResult(id, toolResult(payload)) };
      } catch (error) {
        if (error instanceof McpToolError) return { status: 200, body: rpcResult(id, toolResult({ error: error.message }, true)) };
        console.error('Admin MCP tool failed:', error?.code || error?.name || 'unexpected');
        return { status: 200, body: rpcResult(id, toolResult({ error: 'The admin data could not be read. Try again shortly.' }, true)) };
      }
    }
    return { status: 200, body: rpcError(id, -32601, `Method not found: ${method}`) };
  } catch (error) {
    console.error('Admin MCP request failed:', error?.code || error?.name || 'unexpected');
    return { status: 200, body: rpcError(id, -32603, 'The admin MCP could not complete that request.') };
  }
}

export function originFromHeaders({ url, forwardedProto = '', forwardedHost = '', host = '' } = {}) {
  const parsed = new URL(url);
  const proto = String(forwardedProto || parsed.protocol.replace(':', '')).split(',')[0].trim() || 'https';
  const hostname = String(forwardedHost || host || parsed.host).split(',')[0].trim() || parsed.host;
  return `${proto}://${hostname}`;
}

export function protectedResourceMetadata(origin) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: [ADMIN_MCP_SCOPE],
  };
}

export function authorizationServerMetadata(origin) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [ADMIN_MCP_SCOPE],
  };
}

export function unauthorizedChallenge(origin) {
  return `Bearer realm="spagym-admin", resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
}

export function isAllowedRedirectUri(value, nodeEnv = process.env.NODE_ENV) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  if (nodeEnv !== 'production' && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
  if (url.protocol !== 'https:') return false;
  return /(^|\.)grok\.com$/i.test(url.hostname) || /(^|\.)x\.ai$/i.test(url.hostname);
}

export function hashSecret(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function newSecret(prefix) {
  return `${prefix}${randomBytes(32).toString('base64url')}`;
}

export function safeEqualHex(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export function pkceMatches(verifier, challenge) {
  const value = String(verifier || '');
  const expected = String(challenge || '');
  if (!/^[\w\-._~]{43,128}$/.test(value)) return false;
  if (!/^[\w\-]{43,128}$/.test(expected)) return false;
  const digest = createHash('sha256').update(value).digest('base64url');
  return safeEqualHex(digest, expected);
}

export function readBearer(header) {
  const value = String(header || '');
  if (!value.startsWith('Bearer ')) return '';
  return value.slice(7).trim();
}

export function normalizeScope(value) {
  const requested = String(value || '').split(/\s+/).filter(Boolean);
  if (!requested.length) return ADMIN_MCP_SCOPE;
  return requested.includes(ADMIN_MCP_SCOPE) ? ADMIN_MCP_SCOPE : '';
}

export function validateClientRegistration(body = {}) {
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map((uri) => String(uri || '').trim()) : [];
  if (!redirectUris.length || redirectUris.length > 5) {
    return { ok: false, error: 'invalid_client_metadata', description: 'Provide 1 to 5 redirect URIs.' };
  }
  if (redirectUris.some((uri) => uri.length > 300 || !isAllowedRedirectUri(uri))) {
    return { ok: false, error: 'invalid_redirect_uri', description: 'Redirect URIs must be HTTPS addresses on grok.com or x.ai.' };
  }
  const name = clean(body.client_name).slice(0, 120) || 'Grok';
  return { ok: true, client: { clientName: name, redirectUris: [...new Set(redirectUris)] } };
}

export function validateAuthorizeRequest(params = {}, client) {
  const redirectUri = clean(params.redirect_uri || params.redirectUri);
  const registered = Array.isArray(client?.redirectUris) && client.redirectUris.includes(redirectUri) && isAllowedRedirectUri(redirectUri);
  if (!client || !registered) {
    return { ok: false, redirect: false, error: 'invalid_request', description: 'The OAuth client or redirect URI is not registered.' };
  }
  const fail = (error, description) => ({ ok: false, redirect: true, redirectUri, state: clean(params.state), error, description });
  if (clean(params.response_type || params.responseType || 'code') !== 'code') return fail('unsupported_response_type', 'Only the authorization code grant is supported.');
  const method = clean(params.code_challenge_method || params.codeChallengeMethod);
  const challenge = clean(params.code_challenge || params.codeChallenge);
  if (method !== 'S256' || !/^[\w\-]{43,128}$/.test(challenge)) return fail('invalid_request', 'PKCE S256 is required.');
  const scope = normalizeScope(params.scope);
  if (!scope) return fail('invalid_scope', 'The only available scope is spagym.admin.read.');
  return {
    ok: true,
    request: {
      clientId: clean(params.client_id || params.clientId),
      redirectUri,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
      scope,
      state: clean(params.state).slice(0, 500),
      resource: clean(params.resource).slice(0, 300),
    },
  };
}

export function authorizationRedirect(redirectUri, { code = '', state = '', error = '', description = '' } = {}) {
  const url = new URL(redirectUri);
  if (error) {
    url.searchParams.set('error', error);
    if (description) url.searchParams.set('error_description', description);
  } else {
    url.searchParams.set('code', code);
  }
  if (state) url.searchParams.set('state', state);
  return url.toString();
}

export function connectPagePath(request) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value) params.set(key, value);
  }
  return `/mcp/connect?${params.toString()}`;
}
