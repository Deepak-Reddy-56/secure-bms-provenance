import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { UserIdentity, UserRole, RolePermissions } from '../types/identity';
import { ALL_IDENTITIES, ROLE_PERMISSIONS, ROLE_LABELS } from '../types/identity';

interface IdentityContextValue {
  identity: UserIdentity;
  setIdentityById: (id: string) => void;
  permissions: RolePermissions;
  roleLabel: string;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<UserIdentity>(ALL_IDENTITIES[0]);

  const setIdentityById = useCallback((id: string) => {
    const found = ALL_IDENTITIES.find(i => i.id === id);
    if (found) setIdentity(found);
  }, []);

  const permissions = ROLE_PERMISSIONS[identity.role];
  const roleLabel   = ROLE_LABELS[identity.role];

  return (
    <IdentityContext.Provider value={{ identity, setIdentityById, permissions, roleLabel }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used inside <IdentityProvider>');
  return ctx;
}

// Convenience re-exports
export { ALL_IDENTITIES };
export type { UserIdentity, UserRole };
