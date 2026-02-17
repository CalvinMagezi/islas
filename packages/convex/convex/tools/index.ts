import type { ToolSet } from "ai";
import {
  showDashboard,
  showMemories,
  showNotifications,
  showProjects,
  showProjectDetail,
  showSettings,
  showUsageStats,
  showNote,
  showNotebook,
} from "./uiTools";
import {
  storeMemory,
  recallMemory,
  updateMemory,
  deleteMemory,
  createProject,
  updateProject,
  setSetting,
} from "./actionTools";
import {
  searchNotes,
  searchWeb,
  loadContext,
} from "./ragTools";
import {
  requestApproval,
  checkApproval,
} from "./approvalTools";

export const allTools: ToolSet = {
  // UI tools — render rich components
  showDashboard,
  showMemories,
  showNotifications,
  showProjects,
  showProjectDetail,
  showSettings,
  showUsageStats,
  showNote,
  showNotebook,
  // Action tools — do work, return confirmations
  storeMemory,
  recallMemory,
  updateMemory,
  deleteMemory,
  createProject,
  updateProject,
  setSetting,
  // RAG tools — search notes and web
  searchNotes,
  searchWeb,
  loadContext,
  // Approval tools — human-in-the-loop safety
  requestApproval,
  checkApproval,
};
