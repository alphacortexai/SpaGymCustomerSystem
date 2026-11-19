import assert from 'node:assert/strict';
import test from 'node:test';
import { generateReportPdf } from './reportPdf.js';
import {
  BIRTHDAY_SECTION,
  FEEDBACK_SECTION,
  assignedSection,
  buildCollaboration,
  buildCollaboratedReportDocument,
  buildCollaboratedSave,
  canEditCollaboratedSection,
  collaboratedReportFileName,
  createCollaboratedReportId,
  historyCallerLabel,
  isCollaboratedReport,
  reportCallerContributions,
  reportInvolvesCaller,
  sectionHeading,
} from './reportCollaboration.js';

const alice = { callerId: 'caller-alice', callerName: 'Alice' };
const bob = { callerId: 'caller-bob', callerName: 'Bob' };

const reportFor = (actingCallerId, actingUserId) => ({
  reportType: 'collaborated-report',
  reportDateKey: '2026-11-19',
  branch: 'Kololo',
  callerId: actingCallerId,
  callerName: actingCallerId === alice.callerId ? 'Alice' : 'Bob',
  collaboration: buildCollaboration({
    birthdayCaller: alice,
    feedbackCaller: bob,
    actingCallerId,
    actingUserId,
  }),
  birthdayClients: [{ clientName: 'Grace', comment: 'Sang to her' }],
  previousDayVisits: [{ clientName: 'Peter', comment: 'The room was cold' }],
  notes: 'Shared handover',
});

test('a collaborated report keeps one id for both callers and both branches of the split', () => {
  const first = createCollaboratedReportId({
    dateKey: '2026-11-19',
    branch: 'Kololo',
    birthdayCallerId: 'caller-alice',
    feedbackCallerId: 'caller-bob',
  });
  const swapped = createCollaboratedReportId({
    dateKey: '2026-11-19',
    branch: 'Kololo',
    birthdayCallerId: 'caller-bob',
    feedbackCallerId: 'caller-alice',
  });
  assert.equal(first, swapped);
  assert.equal(assignedSection(reportFor(alice.callerId, 'user-alice'), alice.callerId), BIRTHDAY_SECTION);
  assert.equal(assignedSection(reportFor(alice.callerId, 'user-alice'), bob.callerId), FEEDBACK_SECTION);
});

test('the shared report is visible to both callers and each one edits only their section', () => {
  const report = reportFor(alice.callerId, 'user-alice');
  assert.equal(isCollaboratedReport(report), true);
  assert.equal(reportInvolvesCaller(report, alice.callerId), true);
  assert.equal(reportInvolvesCaller(report, bob.callerId), true);
  assert.equal(reportInvolvesCaller(report, 'caller-cara'), false);
  assert.equal(canEditCollaboratedSection({ report, section: BIRTHDAY_SECTION, userId: 'user-alice', callerId: alice.callerId }), true);
  assert.equal(canEditCollaboratedSection({ report, section: FEEDBACK_SECTION, userId: 'user-alice', callerId: bob.callerId }), false);
  assert.equal(canEditCollaboratedSection({ report, section: FEEDBACK_SECTION, userId: 'user-bob', callerId: bob.callerId }), true);
  assert.equal(canEditCollaboratedSection({ report, section: BIRTHDAY_SECTION, userId: 'user-bob', callerId: alice.callerId }), false);
  assert.equal(canEditCollaboratedSection({ report, section: FEEDBACK_SECTION, userId: 'user-cara', callerId: bob.callerId }), true);
});

test('saving keeps the other caller’s rows and locks the saved section to that account', () => {
  const created = buildCollaboratedSave({
    incoming: reportFor(alice.callerId, 'user-alice'),
    userId: 'user-alice',
    callerId: alice.callerId,
  });
  assert.equal(created.ok, true);
  assert.equal(created.collaboration.birthday.userId, 'user-alice');
  assert.equal(created.collaboration.feedback.userId, '');
  assert.equal(created.birthdayClients[0].clientName, 'Grace');
  assert.deepEqual(created.previousDayVisits, []);

  const partnerReport = reportFor(bob.callerId, 'user-bob');
  partnerReport.collaboration = created.collaboration;
  partnerReport.birthdayClients = [{ clientName: 'Changed by Bob' }];
  partnerReport.previousDayVisits = [{ clientName: 'Peter', comment: 'Booked a return visit' }];
  partnerReport.customColumns = [{ id: 'action', label: 'Action' }];
  const saved = buildCollaboratedSave({
    existing: { ...created, customColumns: [{ id: 'shift', label: 'Shift' }] },
    incoming: partnerReport,
    userId: 'user-bob',
    callerId: bob.callerId,
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.birthdayClients[0].clientName, 'Grace');
  assert.equal(saved.previousDayVisits[0].comment, 'Booked a return visit');
  assert.equal(saved.collaboration.birthday.userId, 'user-alice');
  assert.equal(saved.collaboration.feedback.userId, 'user-bob');
  assert.deepEqual(saved.customColumns, [{ id: 'shift', label: 'Shift' }, { id: 'action', label: 'Action' }]);
});

test('titles, history, the document, and the PDF name both handlers', () => {
  const report = reportFor(alice.callerId, 'user-alice');
  assert.equal(sectionHeading(report, BIRTHDAY_SECTION), 'A. Birthday babies — handled by Alice');
  assert.equal(sectionHeading(report, FEEDBACK_SECTION), 'B. Feedback — handled by Bob');
  assert.equal(historyCallerLabel(report), 'Birthday babies: Alice · Feedback: Bob');
  assert.equal(collaboratedReportFileName(report, 'pdf'), 'collaborated-report-2026-11-19-kololo-alice-bob.pdf');
  const html = buildCollaboratedReportDocument(report);
  assert.match(html, /Collaborated Report/);
  assert.match(html, /Birthday babies/);
  assert.match(html, /handled by Alice/);
  assert.match(html, /handled by Bob/);
  assert.match(html, /Grace/);
  assert.match(html, /The room was cold/);
  const pdf = generateReportPdf(report);
  const binary = Buffer.from(pdf.split(',')[1], 'base64').toString('latin1');
  assert.match(binary, /Collaborated Report/);
  assert.match(binary, /Birthday babies handled by Alice/);
  assert.match(binary, /Feedback handled by Bob/);
  assert.match(binary, /A\. Birthday babies/);
  assert.match(binary, /B\. Feedback/);
});

test('caller contributions give birthday rows to one handler and feedback rows to the other', () => {
  const [birthday, feedback] = reportCallerContributions(reportFor(alice.callerId, 'user-alice'));
  assert.equal(birthday.name, 'Alice');
  assert.equal(birthday.birthdayRows.length, 1);
  assert.equal(birthday.feedbackRows.length, 0);
  assert.equal(feedback.name, 'Bob');
  assert.equal(feedback.feedbackRows.length, 1);
  assert.equal(feedback.birthdayRows.length, 0);
});

test('a solo report keeps a single caller and its original PDF title', () => {
  const solo = {
    reportType: 'feedback-birthdays-whatsapp-calls',
    reportDateKey: '2026-11-19',
    branch: 'Kololo',
    callerName: 'Alice',
    birthdayClients: [],
    previousDayVisits: [],
  };
  assert.equal(isCollaboratedReport(solo), false);
  assert.equal(historyCallerLabel(solo), 'Alice');
  assert.equal(reportCallerContributions(solo)[0].name, 'Alice');
  const binary = Buffer.from(generateReportPdf(solo).split(',')[1], 'base64').toString('latin1');
  assert.match(binary, /Daily Feedback Report - Alice/);
  assert.doesNotMatch(binary, /Collaborated Report/);
});
