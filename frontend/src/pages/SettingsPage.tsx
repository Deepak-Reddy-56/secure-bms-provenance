import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '../types/api';
import {
  ADMIN_ROLES,
  createAdminUser,
  deleteAdminUser,
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminRole,
  type AdminUser,
} from '../services/adminService';
import './SettingsPage.css';

const ROLE_LABELS: Record<AdminRole, string> = {
  MANUFACTURER: 'Manufacturer',
  CERTIFIER: 'Certifier',
  TRANSPORTER: 'Transporter',
  WAREHOUSE: 'Warehouse',
  ASSEMBLER: 'Assembler',
  AUDITOR: 'Auditor',
};

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return 'The operation could not be completed.';
}

export function SettingsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('MANUFACTURER');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setUsers(await getAdminUsers());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const assignedRoles = useMemo(
    () => new Set(users.map(user => user.role)),
    [users]
  );

  const availableCreateRoles = useMemo(
    () => ADMIN_ROLES.filter(candidate => !assignedRoles.has(candidate)),
    [assignedRoles]
  );

  useEffect(() => {
    if (availableCreateRoles.length > 0 && !availableCreateRoles.includes(role)) {
      setRole(availableCreateRoles[0]);
    }
  }, [availableCreateRoles, role]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !availableCreateRoles.includes(role)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const user = await createAdminUser({
        email: email.trim(),
        name: name.trim(),
        role,
      });

      setUsers(current => [...current, user]);
      setName('');
      setEmail('');

      const nextRoles = ADMIN_ROLES.filter(
        candidate => candidate !== role && !assignedRoles.has(candidate)
      );
      setRole(nextRoles[0] ?? 'MANUFACTURER');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (user: AdminUser, nextRole: AdminRole) => {
    if (nextRole === user.role) {
      return;
    }

    setActionUserId(user.id);
    setError(null);

    try {
      const updated = await updateAdminUserRole(user.id, nextRole);
      setUsers(current =>
        current.map(item => item.id === updated.id ? updated : item)
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionUserId(null);
    }
  };

  const handleStatusChange = async (user: AdminUser) => {
    setActionUserId(user.id);
    setError(null);

    try {
      const updated = await updateAdminUserStatus(user.id, !user.active);
      setUsers(current =>
        current.map(item => item.id === updated.id ? updated : item)
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionUserId(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (deleteUserId !== user.id) {
      setDeleteUserId(user.id);
      return;
    }

    setActionUserId(user.id);
    setError(null);

    try {
      await deleteAdminUser(user.id);
      setUsers(current => current.filter(item => item.id !== user.id));
      setDeleteUserId(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionUserId(null);
    }
  };

  const activeCount = users.filter(user => user.active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Administration</h1>
        <p>
          Provision operational accounts and manage their Fabric roles.
          Each operational role is mapped to one configured Fabric identity.
        </p>
      </div>

      <section className="admin-kpis" aria-label="Administration summary">
        <div className="admin-kpi">
          <span className="admin-kpi-label">Provisioned Users</span>
          <span className="admin-kpi-value">{users.length}</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Active Users</span>
          <span className="admin-kpi-value">{activeCount}</span>
        </div>
        <div className="admin-kpi">
          <span className="admin-kpi-label">Inactive Users</span>
          <span className="admin-kpi-value">{inactiveCount}</span>
        </div>
      </section>

      <section className="admin-section" aria-labelledby="provision-title">
        <div className="admin-section-header">
          <h2 className="admin-section-title" id="provision-title">Provision User</h2>
        </div>

        <div className="admin-section-body">
          <form className="admin-form-grid" onSubmit={handleCreate}>
            <div className="admin-field">
              <label htmlFor="admin-user-name">Name</label>
              <input
                id="admin-user-name"
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="User name"
                disabled={saving || availableCreateRoles.length === 0}
              />
            </div>

            <div className="admin-field">
              <label htmlFor="admin-user-email">Google Account Email</label>
              <input
                id="admin-user-email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="user@example.com"
                disabled={saving || availableCreateRoles.length === 0}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="admin-user-role">Role</label>
              <select
                id="admin-user-role"
                value={role}
                onChange={event => setRole(event.target.value as AdminRole)}
                disabled={saving || availableCreateRoles.length === 0}
              >
                {availableCreateRoles.map(option => (
                  <option key={option} value={option}>
                    {ROLE_LABELS[option]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || availableCreateRoles.length === 0 || !email.trim()}
            >
              {saving ? 'Creating…' : 'Provision User'}
            </button>
          </form>

          {availableCreateRoles.length === 0 && (
            <p className="admin-note">
              All six operational roles are currently assigned.
            </p>
          )}

          {error && (
            <div className="admin-error" role="alert">
              {error}
            </div>
          )}
        </div>
      </section>

      <section className="admin-section" aria-labelledby="accounts-title">
        <div className="admin-section-header">
          <h2 className="admin-section-title" id="accounts-title">Operational Accounts</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadUsers()}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="admin-loading">Loading provisioned accounts…</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">No operational users have been provisioned.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Fabric Identity</th>
                  <th>Google</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const availableRoles = ADMIN_ROLES.filter(
                    candidate => candidate === user.role || !assignedRoles.has(candidate)
                  );
                  const busy = actionUserId === user.id;
                  const deleting = deleteUserId === user.id;

                  return (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-name">
                          {user.name || 'Unnamed user'}
                        </div>
                        <div className="admin-user-email">{user.email}</div>
                      </td>
                      <td>
                        <span className="admin-role">{ROLE_LABELS[user.role]}</span>
                      </td>
                      <td>
                        <span className="admin-identity">{user.fabricIdentity}</span>
                      </td>
                      <td>
                        <span className={user.googleSub ? 'admin-google-linked' : 'admin-google-unlinked'}>
                          {user.googleSub ? 'Linked' : 'Not linked'}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-status ${user.active ? 'active' : 'inactive'}`}>
                          <span className="admin-status-dot" aria-hidden="true" />
                          {user.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions">
                          <select
                            className="admin-role-select"
                            value={user.role}
                            onChange={event =>
                              void handleRoleChange(user, event.target.value as AdminRole)
                            }
                            disabled={busy}
                            aria-label={`Change role for ${user.email}`}
                          >
                            {availableRoles.map(option => (
                              <option key={option} value={option}>
                                {ROLE_LABELS[option]}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleStatusChange(user)}
                            disabled={busy || deleting}
                          >
                            {user.active ? 'Disable' : 'Enable'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => void handleDelete(user)}
                            disabled={busy}
                            aria-label={deleting ? `Confirm delete for ${user.email}` : `Delete ${user.email}`}
                          >
                            {deleting ? 'Confirm Delete' : 'Delete'}
                          </button>

                          {deleting && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setDeleteUserId(null)}
                              disabled={busy}
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
