const MAX_NAME_LENGTH = 120;
const MAX_BRANCH_LENGTH = 80;
const MAX_NOTE_TITLE_LENGTH = 120;
const MAX_NOTE_CONTENT_LENGTH = 5000;

export function cleanText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function validateClientInput({ name, phoneNumber, phoneNumber2, branch }) {
  const cleanName = cleanText(name);
  const cleanPhoneNumber = cleanText(phoneNumber);
  const cleanPhoneNumber2 = cleanText(phoneNumber2);
  const cleanBranch = cleanText(branch);

  if (!cleanName) return { valid: false, error: 'Client name is required.' };
  if (cleanName.length > MAX_NAME_LENGTH) return { valid: false, error: `Client name must be ${MAX_NAME_LENGTH} characters or fewer.` };
  if (!cleanPhoneNumber) return { valid: false, error: 'At least one phone number is required.' };
  if (!cleanBranch) return { valid: false, error: 'Select a branch.' };
  if (cleanPhoneNumber2 && cleanPhoneNumber2 === cleanPhoneNumber) {
    return { valid: false, error: 'The second phone number must be different.' };
  }

  return {
    valid: true,
    value: { name: cleanName, phoneNumber: cleanPhoneNumber, phoneNumber2: cleanPhoneNumber2, branch: cleanBranch },
  };
}

export function validateBranchName(value) {
  const name = cleanText(value);
  if (!name) return { valid: false, error: 'Branch name is required.' };
  if (name.length > MAX_BRANCH_LENGTH) return { valid: false, error: `Branch name must be ${MAX_BRANCH_LENGTH} characters or fewer.` };
  return { valid: true, value: name };
}

export function validateNoteInput({ title, content, branch, visibility }) {
  const cleanTitle = cleanText(title);
  const cleanContent = typeof content === 'string' ? content.trim() : '';
  const cleanBranch = cleanText(branch);
  if (!cleanTitle) return { valid: false, error: 'Note title is required.' };
  if (!cleanContent) return { valid: false, error: 'Note details are required.' };
  if (cleanTitle.length > MAX_NOTE_TITLE_LENGTH) return { valid: false, error: `Note title must be ${MAX_NOTE_TITLE_LENGTH} characters or fewer.` };
  if (cleanContent.length > MAX_NOTE_CONTENT_LENGTH) return { valid: false, error: `Note details must be ${MAX_NOTE_CONTENT_LENGTH} characters or fewer.` };
  if (!['creator', 'branch', 'all'].includes(visibility)) return { valid: false, error: 'Choose a valid note visibility.' };
  if (visibility === 'branch' && !cleanBranch) return { valid: false, error: 'Select a branch for branch-visible notes.' };
  return { valid: true, value: { title: cleanTitle, content: cleanContent, branch: visibility === 'branch' ? cleanBranch : '', visibility } };
}

export function validateInvoiceInput({ clientName, phone, qty, totalAmount }) {
  if (!cleanText(clientName)) return { valid: false, error: 'Select or enter a client name.' };
  if (!cleanText(phone)) return { valid: false, error: 'A client phone number is required.' };
  const quantity = Number(qty);
  const total = Number(totalAmount);
  if (!Number.isInteger(quantity) || quantity < 1) return { valid: false, error: 'Quantity must be at least 1.' };
  if (!Number.isFinite(total) || total < 0) return { valid: false, error: 'Enter a valid invoice amount.' };
  return { valid: true, value: { clientName: cleanText(clientName), phone: cleanText(phone), qty: quantity, totalAmount: total } };
}
