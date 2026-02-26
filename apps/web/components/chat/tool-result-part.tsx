"use client";

import type { ComponentType } from "react";
import { DashboardView } from "@/components/tools/dashboard-view";
import { MemoryList } from "@/components/tools/memory-list";
import { ProjectList } from "@/components/tools/project-list";
import { ProjectDetail } from "@/components/tools/project-detail";
import { SettingsPanel } from "@/components/tools/settings-panel";
import { ThreadListView } from "@/components/tools/thread-list-view";
import { UsageChart } from "@/components/tools/usage-chart";
import { ActionConfirmation } from "@/components/tools/action-confirmation";
import { UnknownTool } from "@/components/tools/unknown-tool";
// Notification component
import { NotificationList } from "@/components/tools/notification-list";
// Notebook & Note components
import { NoteDetail } from "@/components/tools/note-detail";
import { NotebookDetail } from "@/components/tools/notebook-detail";
// RAG tools
import { NotesSearchResult } from "@/components/tools/notes-search-result";
import { WebSearchResult } from "@/components/tools/web-search-result";
import { ContextLoaded } from "@/components/tools/context-loaded";
// Approval tools
import { ApprovalCard } from "@/components/tools/approval-card";
// Oakstone tools
import { PortfolioView } from "@/components/tools/PortfolioView";
import { DealAnalysis } from "@/components/tools/DealAnalysis";
import { DealPipeline } from "@/components/tools/DealPipeline";
import { MarketBrief } from "@/components/tools/MarketBrief";
import { DocumentSearch } from "@/components/tools/DocumentSearch";
import { ReportView } from "@/components/tools/ReportView";

export interface ToolResultProps {
  data: unknown;
  status: string;
  onAction?: (prompt: string) => void;
}

interface ToolResultPartProps {
  toolName: string;
  result: unknown;
  state: string;
  onAction?: (prompt: string) => void;
}

const TOOL_COMPONENT_MAP: Record<string, ComponentType<ToolResultProps>> = {
  showDashboard: DashboardView,
  showMemories: MemoryList,
  showProjects: ProjectList,
  showProjectDetail: ProjectDetail,
  showNotifications: NotificationList,
  showSettings: SettingsPanel,
  showThreads: ThreadListView,
  showUsageStats: UsageChart,
  showNote: NoteDetail,
  showNotebook: NotebookDetail,
  // Action tools
  storeMemory: ActionConfirmation,
  recallMemory: MemoryList,
  updateMemory: ActionConfirmation,
  deleteMemory: ActionConfirmation,
  createProject: ActionConfirmation,
  updateProject: ActionConfirmation,
  setSetting: ActionConfirmation,
  // RAG tools
  searchNotes: NotesSearchResult,
  searchWeb: WebSearchResult,
  loadContext: ContextLoaded,
  // Approval tools
  requestApproval: ApprovalCard,
  checkApproval: ActionConfirmation,
  // Oakstone tools
  showPortfolio: PortfolioView,
  analyzeDeal: DealAnalysis,
  showDealPipeline: DealPipeline,
  showMarketBrief: MarketBrief,
  searchDocuments: DocumentSearch,
  generateReport: ReportView,
};

export function ToolResultPart({
  toolName,
  result,
  state,
  onAction,
}: ToolResultPartProps) {
  if (state !== "output-available") return null;

  const Component = TOOL_COMPONENT_MAP[toolName];

  if (!Component) {
    return <UnknownTool toolName={toolName} data={result} />;
  }

  return <Component data={result} status={state} onAction={onAction} />;
}
