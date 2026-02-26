import type { ToolSet } from "ai";
import { activeConfig } from "../config";
import {
  searchDocuments,
  analyzeDeal,
  generateMemo,
  trackDeal,
  showPortfolio,
  showMarketBrief,
  generateReport,
  showDealPipeline,
} from "./oakstonTools";
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

  // Oakstone POC Tools (conditionally registered)
  ...(activeConfig.features.knowledgeHub ? { searchDocuments } : {}),
  ...(activeConfig.features.dealRoomAI ? { analyzeDeal, generateMemo, trackDeal, showDealPipeline } : {}),
  ...(activeConfig.features.portfolioView ? { showPortfolio } : {}),
  ...(activeConfig.features.macroLens ? { showMarketBrief } : {}),
  ...(activeConfig.features.reportBot ? { generateReport } : {}),
};
