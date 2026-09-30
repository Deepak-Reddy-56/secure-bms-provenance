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
import {
  createAdminComponentType,
  getAdminComponentTypes,
  updateAdminComponentTypeStatus,
} from '../services/componentTypeService';
import type { ComponentTypeConfig } from '../types/componentType';
import type { LocationConfig } from '../types/location';
import {
  createAdminLocation,
  getAdminLocations,
  updateAdminLocationStatus,
} from '../services/locationService';
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

  const [componentTypes, setComponentTypes] = useState<ComponentTypeConfig[]>([]);
  const [componentTypesLoading, setComponentTypesLoading] = useState(true);
  const [componentTypeSaving, setComponentTypeSaving] = useState(false);
  const [componentTypeActionId, setComponentTypeActionId] = useState<string | null>(null);
  const [componentTypeError, setComponentTypeError] = useState<string | null>(null);
  const [componentTypeName, setComponentTypeName] = useState('');
  const [componentTypeCode, setComponentTypeCode] = useState('');
  const [componentNumber, setComponentNumber] = useState('');

  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationActionId, setLocationActionId] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationCode, setLocationCode] = useState('');
  const [locationPincode, setLocationPincode] = useState('');

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

  const loadComponentTypes = useCallback(async () => {
    setComponentTypesLoading(true);
    setComponentTypeError(null);

    try {
      setComponentTypes(await getAdminComponentTypes());
    } catch (err) {
      setComponentTypeError(getErrorMessage(err));
    } finally {
      setComponentTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadComponentTypes();
  }, [loadComponentTypes]);

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true);
    setLocationError(null);

    try {
      setLocations(await getAdminLocations());
    } catch (err) {
      setLocationError(getErrorMessage(err));
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

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

  const handleCreateComponentType = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!componentTypeName.trim() || !componentTypeCode.trim() || !/^\d{2}$/.test(componentNumber.trim())) {
      return;
    }

    setComponentTypeSaving(true);
    setComponentTypeError(null);

    try {
      const componentType = await createAdminComponentType({
        name: componentTypeName.trim(),
        code: componentTypeCode.trim().toUpperCase(),
        componentNumber: componentNumber.trim(),
      });

      setComponentTypes(current => [...current, componentType]);
      setComponentTypeName('');
      setComponentTypeCode('');
      setComponentNumber('');
    } catch (err) {
      setComponentTypeError(getErrorMessage(err));
    } finally {
      setComponentTypeSaving(false);
    }
  };

  const handleComponentTypeStatus = async (componentType: ComponentTypeConfig) => {
    setComponentTypeActionId(componentType.id);
    setComponentTypeError(null);

    try {
      const updated = await updateAdminComponentTypeStatus(
        componentType.id,
        !componentType.active
      );

      setComponentTypes(current =>
        current.map(item => item.id === updated.id ? updated : item)
      );
    } catch (err) {
      setComponentTypeError(getErrorMessage(err));
    } finally {
      setComponentTypeActionId(null);
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

      <section className="admin-section" aria-labelledby="component-types-title">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title" id="component-types-title">Component Type Registry</h2>
            <p className="component-type-subtitle">
              Administrator-controlled codes used to generate every new Component ID.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadComponentTypes()}
            disabled={componentTypesLoading}
          >
            {componentTypesLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="admin-section-body">
          <div className="component-type-rule">
            <div className="component-type-rule-label">Component ID format</div>
            <div className="component-type-rule-value">BMS-{'{TYPE4}'}-{'{NUMBER2}'}{'{DDMMYY}'}{'{SERIAL3}'}</div>
            <div className="component-type-rule-help">
              Example: <span className="mono">BMS-MOTH-01300926001</span>. The administrator owns the 4-letter type code and 2-digit component number. The serial is assigned automatically from 001.
            </div>
          </div>

          <form className="component-type-form" onSubmit={handleCreateComponentType}>
            <div className="admin-field">
              <label htmlFor="component-type-name">Component Name</label>
              <input
                id="component-type-name"
                type="text"
                value={componentTypeName}
                onChange={event => setComponentTypeName(event.target.value)}
                placeholder="Motherboard"
                disabled={componentTypeSaving}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="component-type-code">4-Letter Type Code</label>
              <input
                id="component-type-code"
                type="text"
                value={componentTypeCode}
                onChange={event => setComponentTypeCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                placeholder="MOTH"
                maxLength={4}
                pattern="[A-Z]{4}"
                disabled={componentTypeSaving}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="component-type-number">Component Number</label>
              <input
                id="component-type-number"
                type="text"
                inputMode="numeric"
                value={componentNumber}
                onChange={event => setComponentNumber(event.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="01"
                maxLength={2}
                pattern="[0-9]{2}"
                disabled={componentTypeSaving}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                componentTypeSaving ||
                !componentTypeName.trim() ||
                !/^[A-Z]{4}$/.test(componentTypeCode) ||
                !/^\d{2}$/.test(componentNumber) ||
                componentNumber === '00'
              }
            >
              {componentTypeSaving ? 'Adding…' : 'Add Component Type'}
            </button>
          </form>

          {componentTypeError && (
            <div className="admin-error" role="alert">
              {componentTypeError}
            </div>
          )}

          {componentTypesLoading ? (
            <div className="admin-loading">Loading component type registry…</div>
          ) : componentTypes.length === 0 ? (
            <div className="admin-empty">
              No component types configured. Add Motherboard, Battery, Sensors or other approved component categories here before registration.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table component-type-table">
                <thead>
                  <tr>
                    <th>Component Type</th>
                    <th>Type Code</th>
                    <th>Component Number</th>
                    <th>Status</th>
                    <th>New Registration</th>
                  </tr>
                </thead>
                <tbody>
                  {componentTypes.map(componentType => {
                    const busy = componentTypeActionId === componentType.id;

                    return (
                      <tr key={componentType.id}>
                        <td>
                          <div className="admin-user-name">{componentType.name}</div>
                        </td>
                        <td>
                          <span className="admin-identity">{componentType.code}</span>
                        </td>
                        <td>
                          <span className="admin-identity">{componentType.componentNumber}</span>
                        </td>
                        <td>
                          <span className={`admin-status ${componentType.active ? 'active' : 'inactive'}`}>
                            <span className="admin-status-dot" aria-hidden="true" />
                            {componentType.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => void handleComponentTypeStatus(componentType)}
                            disabled={busy}
                          >
                            {busy ? 'Updating…' : componentType.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="admin-section" aria-labelledby="locations-title">
        <div className="admin-section-header">
          <div>
            <h2 className="admin-section-title" id="locations-title">Location Code Registry</h2>
            <p className="component-type-subtitle">
              Administrator-controlled location codes and pincodes used by shipment records and Shipment IDs.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void loadLocations()}
            disabled={locationsLoading}
          >
            {locationsLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <div className="admin-section-body">
          <div className="component-type-rule">
            <div className="component-type-rule-label">Shipment ID format</div>
            <div className="component-type-rule-value">SHIP-{'{TYPE4}'}-{'{NUMBER2}'}{'{DDMMYY}'}-{'{FROM}'}-{'{TO}'}</div>
            <div className="component-type-rule-help">
              Example: <span className="mono">SHIP-MOTH-01300926-BNG-MYS</span>. Location names, codes and pincodes are selected from this registry.
            </div>
          </div>

          <form className="component-type-form" onSubmit={async event => {
            event.preventDefault();

            if (
              !locationName.trim() ||
              !/^[A-Z]{2,4}$/.test(locationCode) ||
              !/^\d{6}$/.test(locationPincode)
            ) {
              return;
            }

            setLocationSaving(true);
            setLocationError(null);

            try {
              const location = await createAdminLocation({
                name: locationName.trim(),
                code: locationCode,
                pincode: locationPincode,
              });

              setLocations(current => [...current, location]);
              setLocationName('');
              setLocationCode('');
              setLocationPincode('');
            } catch (err) {
              setLocationError(getErrorMessage(err));
            } finally {
              setLocationSaving(false);
            }
          }}>
            <div className="admin-field">
              <label htmlFor="location-name">Location Name</label>
              <input
                id="location-name"
                type="text"
                value={locationName}
                onChange={event => setLocationName(event.target.value)}
                placeholder="Bengaluru"
                disabled={locationSaving}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="location-code">Location Code</label>
              <input
                id="location-code"
                type="text"
                value={locationCode}
                onChange={event => setLocationCode(
                  event.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
                )}
                placeholder="BNG"
                maxLength={4}
                pattern="[A-Z]{2,4}"
                disabled={locationSaving}
                required
              />
            </div>

            <div className="admin-field">
              <label htmlFor="location-pincode">Pincode</label>
              <input
                id="location-pincode"
                type="text"
                inputMode="numeric"
                value={locationPincode}
                onChange={event => setLocationPincode(
                  event.target.value.replace(/\D/g, '').slice(0, 6)
                )}
                placeholder="Enter 6-digit pincode"
                maxLength={6}
                pattern="[0-9]{6}"
                disabled={locationSaving}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                locationSaving ||
                !locationName.trim() ||
                !/^[A-Z]{2,4}$/.test(locationCode) ||
                !/^\d{6}$/.test(locationPincode)
              }
            >
              {locationSaving ? 'Adding…' : 'Add Location'}
            </button>
          </form>

          {locationError && (
            <div className="admin-error" role="alert">
              {locationError}
            </div>
          )}

          {locationsLoading ? (
            <div className="admin-loading">Loading location registry…</div>
          ) : locations.length === 0 ? (
            <div className="admin-empty">
              No locations configured. Add locations such as Bengaluru and Mysuru here before creating shipments.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table component-type-table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Code</th>
                    <th>Pincode</th>
                    <th>Status</th>
                    <th>Shipment Use</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.map(location => {
                    const busy = locationActionId === location.id;

                    return (
                      <tr key={location.id}>
                        <td>
                          <div className="admin-user-name">{location.name}</div>
                        </td>
                        <td>
                          <span className="admin-identity">{location.code}</span>
                        </td>
                        <td>
                          <span className="admin-identity">{location.pincode}</span>
                        </td>
                        <td>
                          <span className={'admin-status ' + (location.active ? 'active' : 'inactive')}>
                            <span className="admin-status-dot" aria-hidden="true" />
                            {location.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={async () => {
                              setLocationActionId(location.id);
                              setLocationError(null);
                              try {
                                const updated = await updateAdminLocationStatus(
                                  location.id,
                                  !location.active
                                );
                                setLocations(current =>
                                  current.map(item => item.id === updated.id ? updated : item)
                                );
                              } catch (err) {
                                setLocationError(getErrorMessage(err));
                              } finally {
                                setLocationActionId(null);
                              }
                            }}
                          >
                            {busy ? 'Updating…' : location.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
