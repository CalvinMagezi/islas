"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "@repo/convex";
import { UploadCloud, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const DOC_TYPES = [
  { value: "im", label: "Investment Memorandum (IM)" },
  { value: "pitch_deck", label: "Pitch Deck" },
  { value: "financial_model", label: "Financial Model" },
  { value: "contract", label: "Legal / Contract" },
  { value: "report", label: "Report / Board Pack" },
  { value: "market_brief", label: "Market Commentary" },
  { value: "memo", label: "IC Memo" },
  { value: "other", label: "Other" },
];

const VERTICALS = [
  { value: "", label: "No vertical / General" },
  { value: "Credit", label: "Credit" },
  { value: "Venture", label: "Venture" },
  { value: "Absolute Return", label: "Absolute Return" },
  { value: "Real Assets", label: "Real Assets" },
  { value: "Digital Assets", label: "Digital Assets" },
  { value: "Listed Assets", label: "Listed Assets" },
];

type UploadState = "idle" | "uploading" | "ingesting" | "done" | "error";

export function DocumentUpload({
  onUploadComplete,
  onClose,
}: {
  onUploadComplete?: () => void;
  onClose?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState("im");
  const [vertical, setVertical] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");

  const generateUploadUrl = useMutation(api.functions.documents.generateUploadUrl);
  const ingestDocument = useAction(api.functions.documents.ingestDocument);

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setState("uploading");
    setProgress("Uploading file...");

    try {
      // 1. Get a short-lived upload URL from Convex storage
      const uploadUrl = await generateUploadUrl();

      // 2. Upload the raw file
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error("File upload failed");
      const { storageId } = await uploadResponse.json();

      // 3. Trigger server-side ingestion: extract text → chunk → embed via OpenRouter → store
      setState("ingesting");
      setProgress("Extracting text and generating embeddings...");

      await ingestDocument({
        storageId,
        title: file.name.replace(/\.[^/.]+$/, ""), // strip extension
        userId: "local-user",
        docType,
        vertical: vertical || undefined,
        companyName: companyName || undefined,
        tags: vertical ? [vertical.toLowerCase().replace(/\s+/g, "-")] : [],
      });

      setState("done");
      setTimeout(() => {
        onUploadComplete?.();
        onClose?.();
      }, 1800);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 p-4 w-80 surface border-border rounded-xl shadow-lg z-50 animate-float-up">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold font-serif text-oakstone-blue dark:text-gray-100 flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-oakstone-gold" /> Upload Document
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {state === "done" ? (
        <div className="flex flex-col py-6 items-center justify-center text-center gap-3">
          <CheckCircle className="w-12 h-12 text-green-500" />
          <div>
            <div className="font-bold text-lg">Ingested</div>
            <div className="text-sm text-muted-foreground">
              Document embedded into KnowledgeHub.
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* File picker */}
          <div className="border-2 border-dashed border-border rounded-lg p-5 flex flex-col items-center bg-muted/50 hover:bg-muted/80 transition-colors cursor-pointer">
            <input
              type="file"
              className="hidden"
              id="doc-upload"
              accept=".pdf,.txt,.md,.docx"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setState("idle");
                setError(null);
              }}
              disabled={state === "uploading" || state === "ingesting"}
            />
            <label htmlFor="doc-upload" className="flex flex-col items-center cursor-pointer text-sm text-center">
              <UploadCloud className="w-7 h-7 text-muted-foreground mb-2" />
              <span className="font-medium">
                {file ? file.name : "Click to select file"}
              </span>
              <span className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT up to 50MB</span>
            </label>
          </div>

          {/* Doc type */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Document Type</label>
            <select
              className="p-2 rounded border bg-transparent text-sm outline-none focus:ring-1 focus:ring-oakstone-gold disabled:opacity-50"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              disabled={state === "uploading" || state === "ingesting"}
            >
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Vertical (optional) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Vertical (optional)</label>
            <select
              className="p-2 rounded border bg-transparent text-sm outline-none focus:ring-1 focus:ring-oakstone-gold disabled:opacity-50"
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              disabled={state === "uploading" || state === "ingesting"}
            >
              {VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Company name (optional) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Company (optional)</label>
            <input
              type="text"
              placeholder="e.g. Acme Ltd"
              className="p-2 rounded border bg-transparent text-sm outline-none focus:ring-1 focus:ring-oakstone-gold disabled:opacity-50"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={state === "uploading" || state === "ingesting"}
            />
          </div>

          {/* Error */}
          {state === "error" && error && (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleUpload}
            disabled={!file || state === "uploading" || state === "ingesting"}
            className="w-full mt-1 bg-oakstone-blue hover:bg-oakstone-secondary disabled:bg-muted disabled:text-muted-foreground text-white p-2 rounded text-sm font-semibold transition-colors flex justify-center items-center gap-2"
          >
            {(state === "uploading" || state === "ingesting") ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress}
              </>
            ) : (
              "Ingest to KnowledgeHub"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
