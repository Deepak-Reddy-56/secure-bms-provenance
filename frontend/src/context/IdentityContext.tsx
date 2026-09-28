import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from './AuthContext';
import type {
  RolePermissions,
  UserIdentity,
  UserRole,
} from '../types/identity';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../types/identity';

interface IdentityContextValue {
  identity: UserIdentity;
  permissions: RolePermissions;
  roleLabel: string;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { role, fabricIdentity } = useAuth();

  if (!role || !fabricIdentity) {
    throw new Error('IdentityProvider requires an operational user.');
  }

  const identity: UserIdentity = {
    id: fabricIdentity,
    role: role as UserRole,
  };

  const permissions = ROLE_PERMISSIONS[identity.role];
  const roleLabel = ROLE_LABELS[identity.role];

  return (
    <IdentityContext.Provider
      value={{ identity, permissions, roleLabel }}
    >
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const context = useContext(IdentityContext);

  if (!context) {
    throw new Error('useIdentity must be used inside <IdentityProvider>');
  }

  return context;
}
