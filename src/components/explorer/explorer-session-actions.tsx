/**
 * Share the current exploration and preview candidate imports before replacing site inputs.
 * Transfer only map state; imported labels and coordinates are user-supplied inputs.
 * @author Sultan
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Link2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMapCoordinates } from "./lunar-map-coordinates";
import {
  candidateFileContents, candidateFileLimitBytes, explorerSessionLink, readCandidateFile,
  type CandidateImport, type ExplorerSession,
} from "./explorer-session";

type ImportState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "error"; message: string }
  | { status: "ready"; imported: CandidateImport };

export function ExplorerSessionActions({ session, ready, hasCurrentWork, onImport }: {
  session: ExplorerSession | null;
  ready: boolean;
  hasCurrentWork: boolean;
  onImport: (imported: CandidateImport) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [copyState, setCopyState] = useState<{ url: string; status: "copied" | "error" } | null>(null);
  const link = session && typeof window !== "undefined" ? explorerSessionLink(session, window.location.href) : "";
  const copied = link !== "" && copyState?.url === link && copyState.status === "copied";
  const copyFailed = link !== "" && copyState?.url === link && copyState.status === "error";

  useEffect(() => () => { request.current++; }, []);

  async function readFile(file: File | undefined) {
    if (!file) return;
    const id = ++request.current;
    if (file.size > candidateFileLimitBytes) {
      setImportState({ status: "error", message: "File is too large. Use a Moonline candidate export up to 16 KB." }); return;
    }
    setImportState({ status: "reading" });
    try {
      const imported = readCandidateFile(await file.text());
      if (request.current !== id) return;
      setImportState(imported ? { status: "ready", imported } :
        { status: "error", message: "Invalid candidate file. Use a Moonline export with up to three sites and an explicit UTC time or no time." });
    } catch {
      if (request.current === id) setImportState({ status: "error", message: "File could not be read. Choose it again." });
    }
  }

  async function copyLink() {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopyState({ url: link, status: "copied" }); }
    catch { setCopyState({ url: link, status: "error" }); }
  }

  function exportSites() {
    if (!session || session.sites.length === 0) return;
    const url = URL.createObjectURL(new Blob([candidateFileContents(session)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "moonline-candidates.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function cancelImport() { request.current++; setImportState({ status: "idle" }); importButton.current?.focus(); }

  return (
    <section className="candidate-section space-y-3" aria-label="Exploration sharing">
      <div className="grid grid-cols-2 gap-2">
        <Button ref={importButton} variant="outline" className="px-3" disabled={!ready || importState.status === "reading"}
          onClick={() => fileInput.current?.click()}><Upload aria-hidden="true" /> Import sites</Button>
        <Button variant="outline" className="px-3" disabled={!session || session.sites.length === 0} onClick={exportSites}><Download aria-hidden="true" /> Export sites</Button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Candidate file" hidden
        onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void readFile(file); }} />
      <Button variant="outline" className="w-full px-3" disabled={!session} onClick={() => void copyLink()}>
        {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />} {copied ? "Link copied" : "Copy exploration link"}
      </Button>
      {copied ? <p role="status" className="sr-only">Exploration link copied.</p> : null}
      {copyFailed ? <div className="space-y-2"><p role="status" className="text-xs text-warning">Copy unavailable. Select the link below.</p>
        <Input aria-label="Exploration link" readOnly value={link} onFocus={event => event.currentTarget.select()} /></div> : null}
      {importState.status === "reading" ? <p role="status" className="text-xs text-content-muted">Reading sites…</p> : null}
      {importState.status === "error" ? <p role="alert" className="text-xs leading-5 text-warning">{importState.message}</p> : null}
      {importState.status === "ready" ? (
        <div className="space-y-3 rounded-md border border-border p-3" role="region" aria-label="Import preview">
          <p className="text-sm font-medium">Import {importState.imported.sites.length} {importState.imported.sites.length === 1 ? "site" : "sites"}</p>
          <ol className="space-y-2 text-xs text-content-muted">{importState.imported.sites.map((site, index) => (
            <li key={`${site.latitude}/${site.longitude}`}><span className="block [overflow-wrap:anywhere] text-content">{site.name ?? `Candidate ${index + 1}`}</span>{formatMapCoordinates(site)}</li>
          ))}</ol>
          <p className="text-xs text-content-muted">{importState.imported.missionTimeUtc ? `${importState.imported.missionTimeUtc.slice(0, 16).replace("T", " ")} UTC` : "Mission time not set"}</p>
          {hasCurrentWork ? <p className="text-xs leading-5 text-warning">Replaces the current sites and mission time.</p> : null}
          <div className="grid grid-cols-2 gap-2"><Button variant="outline" className="px-3" onClick={cancelImport}><X aria-hidden="true" /> Cancel</Button>
            <Button className="px-3" onClick={() => { onImport(importState.imported); setImportState({ status: "idle" }); importButton.current?.focus(); }}>Import</Button></div>
        </div>
      ) : null}
    </section>
  );
}
