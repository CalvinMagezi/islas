import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex";
import * as fs from "fs/promises";
import * as path from "path";

const PublishFileSchema = Type.Object({
    path: Type.String({ description: "Path to the file, relative to the working directory or absolute." }),
    name: Type.Optional(Type.String({ description: "Display name for the file. Defaults to the filename." })),
});

const MIME_TYPES: Record<string, string> = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".ppt": "application/vnd.ms-powerpoint",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".html": "text/html",
    ".htm": "text/html",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
    ".sh": "text/x-shellscript",
    ".py": "text/x-python",
    ".js": "text/javascript",
    ".ts": "text/typescript",
};

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_TYPES[ext] || "application/octet-stream";
}

export function createPublishFileTool(
    client: ConvexClient,
    jobIdRef: { value: string | null },
    targetDir: string,
): AgentTool<typeof PublishFileSchema> {
    return {
        name: "publish_file",
        description:
            "Publish a file you created so the user can download it from the web UI. " +
            "Call this after creating ANY output file (reports, scripts, documents, etc.). " +
            "The path can be absolute or relative to the working directory.",
        parameters: PublishFileSchema,
        label: "Publish File",
        execute: async (_toolCallId, args) => {
            if (!jobIdRef.value) {
                return {
                    content: [{ type: "text", text: "Error: No active job to associate the file with." }],
                    details: {},
                };
            }

            // Resolve absolute path
            const absPath = path.isAbsolute(args.path)
                ? args.path
                : path.resolve(targetDir, args.path);

            // Verify the file exists
            let stat: Awaited<ReturnType<typeof fs.stat>>;
            try {
                stat = await fs.stat(absPath);
            } catch {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: File not found at ${absPath}. Make sure you have written the file before calling publish_file.`,
                        },
                    ],
                    details: {},
                };
            }

            if (!stat.isFile()) {
                return {
                    content: [{ type: "text", text: `Error: ${absPath} is not a file.` }],
                    details: {},
                };
            }

            // Compute the relative path from targetDir (for the download URL)
            const relativePath = path.relative(targetDir, absPath).replace(/\\/g, "/");
            const displayName = args.name || path.basename(absPath);
            const mimeType = getMimeType(absPath);

            try {
                await client.mutation(api.agent.registerWorkspaceFile, {
                    jobId: jobIdRef.value as any,
                    name: displayName,
                    path: relativePath,
                    mimeType,
                    size: stat.size,
                });

                const downloadUrl = `/api/workspace/${relativePath}`;
                return {
                    content: [
                        {
                            type: "text",
                            text: `File published: "${displayName}" (${(stat.size / 1024).toFixed(1)} KB)\nDownload URL: ${downloadUrl}`,
                        },
                    ],
                    details: { path: relativePath, name: displayName, size: stat.size, mimeType },
                };
            } catch (err: any) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error registering file: ${err?.message || String(err)}`,
                        },
                    ],
                    details: {},
                };
            }
        },
    };
}
