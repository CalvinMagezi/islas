/**
 * jobTools.ts — Assembles the governed tool set for a single agent job.
 *
 * Extracted from handleJob() to keep index.ts focused on orchestration.
 */

import {
    createCodingTools,
    createBashTool,
} from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { ConvexClient } from "convex/browser";
import {
    ToolGuardian,
    SecurityProfile,
    DEFAULT_POLICIES,
    createSecuritySpawnHook,
} from "../governance.js";
import { LoadSkillTool, ListSkillsTool } from "../skills.js";
import {
    createLocalContextTool,
    createHeartbeatTool,
    createMCPBridgeTool,
    createSubmitResultTool,
    createChatWithUserTool,
    createPublishFileTool,
    type RpcResultRef,
} from "../tools/index.js";
import { createApprovalCallback } from "./approvalClient.js";
import { logger } from "./logger.js";

export interface JobToolsParams {
    job: any;
    /** Cloud Convex URL (*.convex.cloud) */
    convexUrl: string;
    apiKey: string;
    targetDir: string;
    contextFile: string;
    client: ConvexClient;
    jobIdRef: { value: string | null };
    rpcResultRef: RpcResultRef;
}

export interface JobToolsResult {
    governedTools: AgentTool<any>[];
    securityProfile: SecurityProfile;
}

const profileMap: Record<string, SecurityProfile> = {
    minimal: SecurityProfile.MINIMAL,
    standard: SecurityProfile.STANDARD,
    guarded: SecurityProfile.GUARDED,
    admin: SecurityProfile.ADMIN,
};

/**
 * Build the full governed tool list for a job, applying security profile policies.
 */
export function createJobTools(params: JobToolsParams): JobToolsResult {
    const {
        job,
        convexUrl,
        apiKey,
        targetDir,
        contextFile,
        client,
        jobIdRef,
        rpcResultRef,
    } = params;

    const securityProfile =
        profileMap[job.securityProfile || ""] || SecurityProfile.GUARDED;

    const siteUrl = convexUrl.replace(".cloud", ".site");
    const onApprovalRequired = createApprovalCallback(siteUrl, apiKey, job._id);

    const guardian = new ToolGuardian(
        securityProfile,
        DEFAULT_POLICIES,
        onApprovalRequired,
    );

    // Bash tool with security spawn hook (intercepts commands BEFORE execution)
    const spawnHook = createSecuritySpawnHook(
        securityProfile,
        (msg) => logger.info(msg),
    );
    const secureBashTool = createBashTool(targetDir, { spawnHook });

    // Coding tools minus bash (read, edit, write, find, grep, ls)
    const codingToolsWithoutBash = createCodingTools(targetDir).filter(
        (t: any) => t.name !== "bash",
    );

    const rawTools: AgentTool<any>[] = [
        createLocalContextTool(contextFile),
        createHeartbeatTool(client),
        createMCPBridgeTool(convexUrl),
        LoadSkillTool,
        ListSkillsTool,
        createChatWithUserTool(client, jobIdRef, apiKey),
        createPublishFileTool(client, jobIdRef, targetDir),
        secureBashTool,
        ...codingToolsWithoutBash,
    ];

    if (job.type === "rpc") {
        rawTools.push(createSubmitResultTool(jobIdRef, rpcResultRef));
    }

    const governedTools = rawTools.map((tool) => guardian.govern(tool));

    return { governedTools, securityProfile };
}
