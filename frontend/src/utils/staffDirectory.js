import { isStaffRole } from './roles.js';

function accountName(account) {
  return account?.full_name?.trim()
    || [account?.first_name, account?.last_name].filter(Boolean).join(' ').trim()
    || account?.email
    || 'Team member';
}

export function createStaffDirectory(members = [], accounts = []) {
  const memberEntries = members
    .filter((member) => member?.id && ['owner', 'staff'].includes(member.record_kind))
    .map((member) => ({
      key: `member:${member.id}`,
      id: String(member.id),
      kind: 'member',
      roleLabel: member.record_kind === 'owner' ? 'Owner' : 'Staff',
      name: String(member.full_name || 'Team member').trim(),
      member,
    }));

  const accountEntries = accounts
    .filter((account) => account?.id && isStaffRole(account.role))
    .map((account) => ({
      key: `account:${account.id}`,
      id: String(account.id),
      kind: 'account',
      roleLabel: account.role === 'admin' ? 'Admin' : 'Head',
      name: accountName(account),
      account,
    }));

  return [...memberEntries, ...accountEntries];
}
