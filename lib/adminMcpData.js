import { serializeCheckIn } from './clientDataContract.js';
import { queryClientProfiles } from './clientDataApi.js';
import { getServerFirestore } from './firebase-server.js';
import { ApiError, listBranches } from './guestflowApi.js';
import { McpToolError } from './adminMcp.js';

function plainValue(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plainValue(entry)]));
  }
  return value;
}

async function readInSlices(items, size, read) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    const slice = items.slice(index, index + size);
    const snapshots = await Promise.all(slice.map(read));
    snapshots.forEach((snapshot) => output.push(...snapshot));
  }
  return output;
}

export function createAdminMcpData() {
  const db = () => getServerFirestore();
  return {
    async listBranches() {
      const branches = await listBranches();
      return branches.map((branch) => ({ id: branch.id, name: branch.name }));
    },
    async loadReports({ from, to }) {
      const snapshot = await db().collection('reports')
        .where('reportDateKey', '>=', from)
        .where('reportDateKey', '<=', to)
        .get();
      return snapshot.docs.map((report) => plainValue({ id: report.id, ...report.data() }));
    },
    async loadBirthdayClients(months) {
      const selected = [...new Set(months.map(Number))].filter((month) => month >= 1 && month <= 12);
      return readInSlices(selected, 6, async (month) => {
        const snapshot = await db().collection('clients').where('birthMonth', '==', month).get();
        return snapshot.docs.map((client) => plainValue({ id: client.id, ...client.data() }));
      });
    },
    async loadVisits(dates) {
      const now = new Date();
      return readInSlices(dates, 10, async (date) => {
        const snapshot = await db().collection('guestflowVisits').where('visitDate', '==', date).get();
        return snapshot.docs.map((visit) => serializeCheckIn(visit.id, visit.data(), now));
      });
    },
    async lookupClients({ phone = '', name = '', limit = 10 } = {}) {
      try {
        return await queryClientProfiles({ phone, search: name, limit });
      } catch (error) {
        if (error instanceof ApiError) throw new McpToolError(error.message);
        throw error;
      }
    },
    async countClients(branchNames) {
      const clients = db().collection('clients');
      const totalSnapshot = await clients.count().get();
      const byBranch = await Promise.all(branchNames.map(async (branch) => {
        const snapshot = await clients.where('branch', '==', branch).count().get();
        return { branch, count: snapshot.data().count };
      }));
      return { total: totalSnapshot.data().count, byBranch };
    },
  };
}
