export const SOLO_REPORT_TYPE = 'feedback-birthdays-whatsapp-calls';
export const COLLABORATED_REPORT_TYPE = 'collaborated-report';
export const BIRTHDAY_SECTION = 'birthday';
export const FEEDBACK_SECTION = 'feedback';

const SECTION_KEYS = {
  [BIRTHDAY_SECTION]: 'birthdayClients',
  [FEEDBACK_SECTION]: 'previousDayVisits',
};

const oppositeSection = (section) => (section === BIRTHDAY_SECTION ? FEEDBACK_SECTION : BIRTHDAY_SECTION);

export const slugPart = (value, fallback = 'item') => {
  const slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || fallback;
};

export const normalizeCollaborationSlot = (slot = {}) => ({
  callerId: String(slot?.callerId || '').trim(),
  callerName: String(slot?.callerName || '').trim(),
  userId: String(slot?.userId || '').trim(),
});

export const normalizeCollaboration = (value) => {
  if (!value || typeof value !== 'object') return null;
  const birthday = normalizeCollaborationSlot(value.birthday);
  const feedback = normalizeCollaborationSlot(value.feedback);
  if (!birthday.callerId || !feedback.callerId || !birthday.callerName || !feedback.callerName) return null;
  return { birthday, feedback };
};

export const isCollaboratedReport = (report) => (
  report?.reportType === COLLABORATED_REPORT_TYPE && Boolean(normalizeCollaboration(report?.collaboration))
);

export const createCollaboratedReportId = ({ dateKey, branch, birthdayCallerId, feedbackCallerId } = {}) => {
  const callers = [birthdayCallerId, feedbackCallerId].map((callerId) => String(callerId || '').trim()).sort();
  return `collab__${String(dateKey || '').slice(0, 10)}__${slugPart(branch, 'branch')}__${callers.join('__')}`;
};

export const buildCollaboration = ({ birthdayCaller, feedbackCaller, actingCallerId = '', actingUserId = '' } = {}) => {
  const birthday = normalizeCollaborationSlot(birthdayCaller);
  const feedback = normalizeCollaborationSlot(feedbackCaller);
  return {
    birthday: { ...birthday, userId: birthday.callerId === actingCallerId ? String(actingUserId || '') : '' },
    feedback: { ...feedback, userId: feedback.callerId === actingCallerId ? String(actingUserId || '') : '' },
  };
};

export const assignedSection = (report, callerId) => {
  const collaboration = normalizeCollaboration(report?.collaboration);
  if (!collaboration || !callerId) return null;
  if (collaboration.birthday.callerId === callerId) return BIRTHDAY_SECTION;
  if (collaboration.feedback.callerId === callerId) return FEEDBACK_SECTION;
  return null;
};

export const handlerName = (report, section) => normalizeCollaboration(report?.collaboration)?.[section]?.callerName || '';

export const reportInvolvesCaller = (report, callerId) => {
  if (!callerId) return true;
  if (report?.callerId === callerId || report?.ownerId === callerId) return true;
  const collaboration = normalizeCollaboration(report?.collaboration);
  if (!collaboration) return false;
  return collaboration.birthday.callerId === callerId || collaboration.feedback.callerId === callerId;
};

export const canEditCollaboratedSection = ({ report, section, userId = '', callerId = '', isAdmin = false } = {}) => {
  if (!isCollaboratedReport(report)) return false;
  if (isAdmin) return true;
  const collaboration = normalizeCollaboration(report.collaboration);
  const slot = collaboration?.[section];
  if (!slot || !userId) return false;
  if (slot.userId) return slot.userId === userId;
  if (slot.callerId !== callerId) return false;
  return collaboration[oppositeSection(section)].userId !== userId;
};

export const sectionHeading = (report, section) => {
  const name = handlerName(report, section);
  if (section === BIRTHDAY_SECTION) return name ? `A. Birthday babies — handled by ${name}` : 'A. Birthday babies';
  return name ? `B. Feedback — handled by ${name}` : 'B. Feedback';
};

export const sectionDescription = (report, section) => {
  const name = handlerName(report, section) || 'This caller';
  if (section === BIRTHDAY_SECTION) return `${name} handles Birthday babies in this shared report.`;
  return `${name} handles feedback, calls, and WhatsApp messages in this shared report.`;
};

export const collaboratedDetails = (report) => {
  const collaboration = normalizeCollaboration(report?.collaboration);
  if (!collaboration) return [];
  return [
    `Birthday babies: ${collaboration.birthday.callerName}`,
    `Feedback: ${collaboration.feedback.callerName}`,
  ];
};

export const historyCallerLabel = (report) => {
  const collaboration = normalizeCollaboration(report?.collaboration);
  if (report?.reportType !== COLLABORATED_REPORT_TYPE || !collaboration) return report?.callerName || report?.ownerName || 'Caller';
  return `Birthday babies: ${collaboration.birthday.callerName} · Feedback: ${collaboration.feedback.callerName}`;
};

export const collaboratedReportFileName = (report, extension) => {
  const collaboration = normalizeCollaboration(report?.collaboration);
  const date = String(report?.reportDateKey || 'undated').slice(0, 10);
  const birthday = slugPart(collaboration?.birthday.callerName, 'birthday');
  const feedback = slugPart(collaboration?.feedback.callerName, 'feedback');
  return `collaborated-report-${date}-${slugPart(report?.branch, 'branch')}-${birthday}-${feedback}.${extension}`;
};

const unionCustomColumns = (existing = [], incoming = []) => {
  const merged = new Map();
  [...existing, ...incoming].forEach((column) => {
    if (!column?.id || !column?.label) return;
    merged.set(String(column.id), { id: String(column.id), label: String(column.label) });
  });
  return [...merged.values()];
};

export const buildCollaboratedSave = ({ existing = null, incoming, userId = '', callerId = '', isAdmin = false } = {}) => {
  const source = existing?.collaboration || incoming?.collaboration;
  const collaboration = normalizeCollaboration(source);
  if (!collaboration) return { ok: false, error: 'Choose who handles Birthday babies and who handles feedback.' };
  if (collaboration.birthday.callerId === collaboration.feedback.callerId) {
    return { ok: false, error: 'Birthday babies and feedback need two different callers.' };
  }

  const reportShape = { reportType: COLLABORATED_REPORT_TYPE, collaboration };
  const mine = assignedSection(reportShape, callerId);
  const canBirthday = canEditCollaboratedSection({ report: reportShape, section: BIRTHDAY_SECTION, userId, callerId, isAdmin });
  const canFeedback = canEditCollaboratedSection({ report: reportShape, section: FEEDBACK_SECTION, userId, callerId, isAdmin });
  if (!canBirthday && !canFeedback) return { ok: false, error: 'You can edit only the section assigned to you.' };

  const next = {
    birthday: { ...collaboration.birthday },
    feedback: { ...collaboration.feedback },
  };
  let birthdayClients = existing?.birthdayClients || [];
  let previousDayVisits = existing?.previousDayVisits || [];
  let birthdayFromIncoming = false;
  let feedbackFromIncoming = false;
  const claim = (section) => {
    if (!isAdmin && section && !next[section].userId) next[section].userId = userId;
  };

  if (!existing) {
    next.birthday.userId = mine === BIRTHDAY_SECTION ? userId : '';
    next.feedback.userId = mine === FEEDBACK_SECTION ? userId : '';
    birthdayFromIncoming = isAdmin || mine === BIRTHDAY_SECTION;
    feedbackFromIncoming = isAdmin || mine === FEEDBACK_SECTION;
    if (birthdayFromIncoming) birthdayClients = incoming?.birthdayClients || [];
    if (feedbackFromIncoming) previousDayVisits = incoming?.previousDayVisits || [];
  } else {
    if (canBirthday) {
      birthdayClients = incoming?.birthdayClients || [];
      birthdayFromIncoming = true;
      claim(BIRTHDAY_SECTION);
    }
    if (canFeedback) {
      previousDayVisits = incoming?.previousDayVisits || [];
      feedbackFromIncoming = true;
      claim(FEEDBACK_SECTION);
    }
  }

  return {
    ok: true,
    collaboration: next,
    birthdayClients,
    previousDayVisits,
    birthdayFromIncoming,
    feedbackFromIncoming,
    notes: incoming?.notes ?? existing?.notes ?? '',
    customColumns: unionCustomColumns(existing?.customColumns, incoming?.customColumns),
  };
};

export const reportCallerContributions = (report) => {
  const collaboration = normalizeCollaboration(report?.collaboration);
  const feedbackRows = [...(report?.previousDayVisits || []), ...(report?.followUps || [])];
  if (report?.reportType !== COLLABORATED_REPORT_TYPE || !collaboration) {
    return [{
      id: report?.callerId || report?.ownerId || report?.callerName || report?.ownerName || 'unassigned',
      name: report?.callerName || report?.ownerName || 'Unassigned caller',
      birthdayRows: report?.birthdayClients || [],
      feedbackRows,
      whatsappRows: report?.whatsappMessages || [],
    }];
  }
  return [
    {
      id: collaboration.birthday.callerId,
      name: collaboration.birthday.callerName,
      birthdayRows: report?.birthdayClients || [],
      feedbackRows: [],
      whatsappRows: [],
    },
    {
      id: collaboration.feedback.callerId,
      name: collaboration.feedback.callerName,
      birthdayRows: [],
      feedbackRows,
      whatsappRows: report?.whatsappMessages || [],
    },
  ];
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const documentRows = (rows = []) => (Array.isArray(rows) ? rows : []).filter((row) => (
  row?.clientName || row?.phoneNumber || row?.contactMethod || row?.comment
));

const documentTable = (rows) => {
  if (!rows.length) return '<p class="empty">No entries recorded.</p>';
  const body = rows.map((row, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(row.clientName)}</td><td>${escapeHtml(row.phoneNumber)}</td><td>${escapeHtml(row.contactMethod)}</td><td>${escapeHtml(row.comment)}</td></tr>`).join('');
  return `<table><thead><tr><th>No.</th><th>Client name</th><th>Phone</th><th>Contact mode</th><th>Feedback / comments</th></tr></thead><tbody>${body}</tbody></table>`;
};

export const buildCollaboratedReportDocument = (report) => {
  const collaboration = normalizeCollaboration(report?.collaboration);
  const birthdayName = collaboration?.birthday.callerName || 'Unassigned';
  const feedbackName = collaboration?.feedback.callerName || 'Unassigned';
  const notes = String(report?.notes || '').trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Collaborated Report</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1e293b; margin: 32px; }
  .banner { background: #1e3a8a; color: white; padding: 18px 22px; }
  .banner p { margin: 4px 0 0; letter-spacing: 0.08em; font-size: 12px; text-transform: uppercase; }
  h1 { margin: 0; font-size: 28px; }
  .details { display: table; width: 100%; margin: 18px 0 8px; border-collapse: separate; }
  .detail { display: table-cell; width: 50%; padding: 12px 14px; vertical-align: top; }
  .birthday { background: #eff6ff; border-left: 6px solid #1d4ed8; }
  .feedback { background: #ecfdf5; border-left: 6px solid #047857; }
  .detail span { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
  .detail strong { display: block; margin-top: 4px; font-size: 18px; }
  h2 { margin: 28px 0 8px; font-size: 18px; }
  .meta { color: #475569; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #1e293b; color: white; text-align: left; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; padding: 8px; }
  td { border: 1px solid #e2e8f0; padding: 8px; font-size: 13px; vertical-align: top; }
  .empty { color: #64748b; font-style: italic; }
</style>
</head>
<body>
  <div class="banner"><p>Shared by two callers</p><h1>Collaborated Report</h1></div>
  <p class="meta">Report date: ${escapeHtml(report?.reportDateKey || 'Undated')} &nbsp;|&nbsp; Branch: ${escapeHtml(report?.branch || 'Not selected')}</p>
  <div class="details">
    <div class="detail birthday"><span>Birthday babies</span><strong>${escapeHtml(birthdayName)}</strong></div>
    <div class="detail feedback"><span>Feedback</span><strong>${escapeHtml(feedbackName)}</strong></div>
  </div>
  <h2>${escapeHtml(sectionHeading(report, BIRTHDAY_SECTION))}</h2>
  <p class="meta">${escapeHtml(sectionDescription(report, BIRTHDAY_SECTION))}</p>
  ${documentTable(documentRows(report?.birthdayClients))}
  <h2>${escapeHtml(sectionHeading(report, FEEDBACK_SECTION))}</h2>
  <p class="meta">${escapeHtml(sectionDescription(report, FEEDBACK_SECTION))}</p>
  ${documentTable(documentRows([...(report?.previousDayVisits || []), ...(report?.followUps || [])]))}
  ${notes ? `<h2>Additional notes</h2><p>${escapeHtml(notes)}</p>` : ''}
</body>
</html>`;
};

export const collaboratedSectionKey = (section) => SECTION_KEYS[section] || '';
