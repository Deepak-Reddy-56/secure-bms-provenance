// ============================================================
// Identity & Role types for Day 2
// ============================================================

export type UserRole =
  | 'MANUFACTURER'
  | 'CERTIFIER'
  | 'TRANSPORTER'
  | 'WAREHOUSE'
  | 'ASSEMBLER'
  | 'AUDITOR';

export interface UserIdentity {
  id: string;      // e.g. "manufacturer1"
  role: UserRole;
}

// All available identities for the Day 2 dev selector
export const ALL_IDENTITIES: UserIdentity[] = [
  { id: 'manufacturer1', role: 'MANUFACTURER' },
  { id: 'certifier1',    role: 'CERTIFIER'    },
  { id: 'transporter1',  role: 'TRANSPORTER'  },
  { id: 'warehouse1',    role: 'WAREHOUSE'    },
  { id: 'assembler1',    role: 'ASSEMBLER'    },
  { id: 'auditor1',      role: 'AUDITOR'      },
];

// ── Permission helpers ────────────────────────────────────────

export interface RolePermissions {
  canRegister:  boolean;
  canCertify:   boolean;
  canShip:      boolean;
  canReceive:   boolean;
  canTransfer:  boolean;
  canAssemble:  boolean;
  canView:      boolean;   // always true
  canViewHistory: boolean; // always true
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  MANUFACTURER: {
    canRegister:    true,
    canCertify:     false,
    canShip:        false,
    canReceive:     false,
    canTransfer:    false,
    canAssemble:    false,
    canView:        true,
    canViewHistory: true,
  },
  CERTIFIER: {
    canRegister:    false,
    canCertify:     true,
    canShip:        false,
    canReceive:     false,
    canTransfer:    false,
    canAssemble:    false,
    canView:        true,
    canViewHistory: true,
  },
  TRANSPORTER: {
    canRegister:    false,
    canCertify:     false,
    canShip:        true,
    canReceive:     false,
    canTransfer:    false,
    canAssemble:    false,
    canView:        true,
    canViewHistory: true,
  },
  WAREHOUSE: {
    canRegister:    false,
    canCertify:     false,
    canShip:        false,
    canReceive:     true,
    canTransfer:    true,
    canAssemble:    false,
    canView:        true,
    canViewHistory: true,
  },
  ASSEMBLER: {
    canRegister:    false,
    canCertify:     false,
    canShip:        false,
    canReceive:     false,
    canTransfer:    false,
    canAssemble:    true,
    canView:        true,
    canViewHistory: true,
  },
  AUDITOR: {
    canRegister:    false,
    canCertify:     false,
    canShip:        false,
    canReceive:     false,
    canTransfer:    false,
    canAssemble:    false,
    canView:        true,
    canViewHistory: true,
  },
};

export function getPermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  MANUFACTURER: 'Manufacturer',
  CERTIFIER:    'Certifier',
  TRANSPORTER:  'Transporter',
  WAREHOUSE:    'Warehouse',
  ASSEMBLER:    'Assembler',
  AUDITOR:      'Auditor',
};
