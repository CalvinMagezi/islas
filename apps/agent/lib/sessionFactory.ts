/**
 * sessionFactory.ts — Creates a Pi SDK agent session for a single job.
 *
 * Extracted from handleJob() to keep index.ts focused on orchestration.
 */

import {
    createAgentSession,
    SettingsManager,
} from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import * as fs from "fs";
import { SecurityProfile, PROFILE_TOOL_NAMES } from "../governance.js";
import { resolveOpenRouterModel } from "./models.js";
import { logger } from "./logger.js";

// Helper to cast 'any' for excessive type instantiation issues
const cast = <T>(value: any): T => value as T;

export interface JobSessionParams {
    job: any;
    governedTools: AgentTool<any>[];
    securityProfile: SecurityProfile;
    defaultModelId: string;
    targetDir: string;
}

export interface JobSessionResult {
    session: any;
    /** Comma-separated list of top-level files in targetDir (for prompt context) */
    folderContent: string;
}

/**
 * Build a Pi SDK agent session configured for the given job.
 * Note: `currentSession = session` must be assigned by the caller so the
 * shutdown handler can access it.
 */
export async function createJobSession(
    params: JobSessionParams,
): Promise<JobSessionResult> {
    const { job, governedTools, securityProfile, defaultModelId, targetDir } =
        params;

    const settingsManager = SettingsManager.inMemory({
        compaction: {
            enabled: true,
            reserveTokens: 4000,
            keepRecentTokens: 20000,
        },
        retry: {
            enabled: true,
            maxRetries: 3,
            baseDelayMs: 500,
            maxDelayMs: 30_000,
        },
    });

    // Per-job model override takes priority over the environment default
    const effectiveModelId = job.modelOverride || defaultModelId;
    const model = resolveOpenRouterModel(effectiveModelId);

    if (job.modelOverride) {
        logger.info("Job model override", {
            jobId: job._id,
            model: job.modelOverride,
        });
    }

    // Scan folder for project context grounding
    let folderContent = "";
    try {
        const files = fs.readdirSync(targetDir);
        folderContent = files.slice(0, 20).join(", ");
        if (files.length > 20) folderContent += "...";
    } catch (_e) {
        // Folder read errors are non-critical
    }

    const sessionOptions: any = {
        tools: cast(governedTools),
        model,
        settingsManager,
    };

    if (job.thinkingLevel) {
        sessionOptions.thinkingLevel = job.thinkingLevel;
        logger.info("Job thinking level", {
            jobId: job._id,
            thinkingLevel: job.thinkingLevel,
        });
    }

    const { session } = await createAgentSession(sessionOptions);

    // Dynamic tool activation based on security profile
    const profileToolNames = PROFILE_TOOL_NAMES[securityProfile];
    if (profileToolNames !== "*") {
        try {
            session.setActiveToolsByName(profileToolNames);
            logger.info("Tools restricted by profile", {
                profile: securityProfile,
                tools: profileToolNames,
            });
        } catch (e) {
            // setActiveToolsByName may not be available on all Pi SDK versions
            logger.warn("Dynamic tool activation not supported", {
                error: (e as Error).message,
            });
        }
    }

    return { session, folderContent };
}
