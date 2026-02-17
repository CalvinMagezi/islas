/**
 * Approvals API
 * Re-exports functions from functions/approvals.ts to make them available at the root level
 */

export {
  resolveApproval,
  getApproval,
  getByJob,
  listPendingApprovals,
  pendingApprovalCount,
} from "./functions/approvals.js";
