export const SPA_SYS_SCOPES = [
  'clients:read',
  'clients:update',
  'checkins:read',
  'checkins:register',
  'checkouts:write',
  'branches:read',
];

export const SPA_SYS_READ_SCOPES = ['clients:read', 'checkins:read', 'branches:read'];

export const SPA_SYS_SCOPE_OPTIONS = [
  { id: 'clients:read', label: 'Read clients', detail: 'Look up a client by phone, name, or id.' },
  { id: 'clients:update', label: 'Update clients', detail: 'Change name, phone, and birthday.' },
  { id: 'checkins:read', label: 'Read one client\'s check-ins', detail: 'Visits for a phone number or client id.' },
  { id: 'checkins:register', label: 'Read a branch register', detail: 'A whole branch or day, without naming one client.' },
  { id: 'checkouts:write', label: 'Check clients out', detail: 'Close the open visit.' },
  { id: 'branches:read', label: 'List branches', detail: 'The branch names this spa uses.' },
];
