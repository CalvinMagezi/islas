/**
 * Helper to call approval functions from tool handlers.
 * Separated to break circular type inference between
 * tools/approvalTools.ts ↔ _generated/api ↔ functions/approvals.ts
 *
 * The @ts-expect-error is needed because approvals.ts has self-referencing
 * internal calls (e.g. createApprovalFromAgent → createApproval) which makes
 * the entire internal.functions.approvals namespace deeply recursive.
 */
import { internal } from "../_generated/api";

// @ts-ignore — circular type in internal.functions.approvals (see above)
export const createApprovalRef: any = internal.functions.approvals.createApproval;
export const getApprovalInternalRef: any = internal.functions.approvals.getApprovalInternal;
