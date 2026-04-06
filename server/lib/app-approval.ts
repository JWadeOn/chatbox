/** App governance lifecycle per engineering spec (pending → approved → disabled). */
export const APP_APPROVAL_PENDING = 'pending' as const;
export const APP_APPROVAL_APPROVED = 'approved' as const;
export const APP_APPROVAL_DISABLED = 'disabled' as const;

export type AppApprovalStatus =
  | typeof APP_APPROVAL_PENDING
  | typeof APP_APPROVAL_APPROVED
  | typeof APP_APPROVAL_DISABLED;

export function isAppApprovalStatus(v: string): v is AppApprovalStatus {
  return v === APP_APPROVAL_PENDING || v === APP_APPROVAL_APPROVED || v === APP_APPROVAL_DISABLED;
}

export function isApprovedForStudents(status: string): boolean {
  return status === APP_APPROVAL_APPROVED;
}
