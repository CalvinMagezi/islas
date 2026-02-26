export interface JobPromptConfig {
    targetDir: string;
    folderContent: string;
    pinnedContext: string;
    preloadedSkills: string;
    jobType?: string;
    instruction: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    pendingUserMessage?: string | null;
}

export function buildJobPrompt(config: JobPromptConfig): string {
    const {
        targetDir,
        folderContent,
        pinnedContext,
        preloadedSkills,
        jobType,
        instruction,
        conversationHistory,
        pendingUserMessage,
    } = config;

    const coreRules = `# CORE OPERATING RULES
1. **Never Hallucinate Actions**: If you say you are creating a file or running a command, you MUST call the tool to do it. Never just describe the outcome.
2. **Mandatory Verification**: After creating a file or running a command, you MUST verify it (e.g., list the directory or read the file) before telling the user it is done.
3. **Be Surgical**: When editing files, find the exact string and replace it. Do not rewrite entire files unless necessary.
4. **Load Skills First**: If a task matches an available skill, call 'load_skill' BEFORE taking any other action.
5. **EXECUTION RULE**: After writing any script, immediately run it with bash to produce output. Writing a script without running it is an incomplete task.
6. **VERIFICATION RULE**: After creating any file, verify it exists: run \`ls -la <filename>\` to confirm before proceeding.
7. **PUBLISHING RULE**: After creating any file the user should access (reports, documents, generated output), call \`publish_file\` to make it downloadable from the web UI.
8. **COMPLETION RULE**: Never mark a task done unless the output artifact has been verified to exist on disk AND published with \`publish_file\` if it is a user-facing file.`;

    const sysInfo = `SYSTEM INFO:
Working Directory: ${targetDir}
Contents: ${folderContent}`;

    if (jobType === "interactive" && conversationHistory && conversationHistory.length > 0) {
        const history = pendingUserMessage ? conversationHistory.slice(0, -1) : conversationHistory.slice(0, -1);

        const historyText = history.length > 0
            ? history.map((msg) => `${msg.role === "user" ? "User" : "Agent"}: ${msg.content}`).join("\n")
            : "No previous conversation.";

        return `${sysInfo}

${coreRules}

${pinnedContext}

${preloadedSkills}

# CONVERSATION HISTORY
${historyText}

# CURRENT TASK
${instruction}

IMPORTANT: Focus ONLY on the CURRENT TASK. Verify your work with tools before responding.`;
    } else {
        return `${sysInfo}

${coreRules}

${pinnedContext}

${preloadedSkills}

# USER INSTRUCTION
${instruction}

IMPORTANT: Verify your work with tools before responding.`;
    }
}
