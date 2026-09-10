<script lang="ts">
  import { onMount } from "svelte";
  import Badge from "@/components/Badge.svelte";
  import Button from "@/components/Button.svelte";
  import Card from "@/components/Card.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import Toggle from "@/components/Toggle.svelte";
  import { slugify } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
  import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
  import SectionHeader from "@/components/SectionHeader.svelte";

  let scripts = $state<UserScriptRecord[]>([]);
  let isLoading = $state(true);
  let status = $state<{ text: string; isError?: boolean } | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let draftCode = $state("");
  let draftDirty = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let installUrl = $state("");
  let installing = $state(false);
  let runLogs = $state<Record<string, UserScriptRunLogEntry[]>>({});
  let newScriptName = $state("");
  let fileInput = $state<HTMLInputElement | null>(null);

  onMount(async () => {
    await refresh();
  });

  async function refresh(): Promise<void> {
    isLoading = true;
    try {
      scripts = await sendMessage<UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Failed to load scripts", true);
    } finally {
      isLoading = false;
    }
  }

  function showStatus(text: string, isError = false): void {
    status = { text, isError };
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (status?.text === text) status = null;
    }, 2500);
  }

  async function toggle(script: UserScriptRecord, enabled: boolean): Promise<void> {
    scripts = await sendMessage<UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.TOGGLE, {
      id: script.id,
      enabled,
    });
  }

  async function createScript(): Promise<void> {
    const name = newScriptName.trim() || "New script";
    newScriptName = "";
    const record = await sendMessage<UserScriptRecord>(USER_SCRIPTS_ACTIONS.SAVE, {
      record: {
        id: `us_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        code: "",
        meta: {
          name,
          namespace: "extensible/userscripts",
          version: "1.0.0",
          description: "",
          matches: ["*://*/*"],
          excludes: [],
          runAt: "document-idle",
          grants: ["none"],
          requires: [],
          resources: {},
          injectInto: "content",
          connects: [],
          updateURL: "",
          downloadURL: "",
          icon: "",
        },
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastRunAt: null,
      },
    });
    // Seed a template header if the caller wants a blank canvas.
    if (!record.code) {
      record.code = `// ==UserScript==\n// @name         ${name}\n// @version      1.0.0\n// @match        *://*/*\n// @grant        none\n// ==/UserScript==\n\n(function () {\n  "use strict";\n})();\n`;
      await sendMessage(USER_SCRIPTS_ACTIONS.SAVE, { record });
    }
    scripts = [...scripts, record];
    startEditing(record);
  }

  async function duplicate(script: UserScriptRecord): Promise<void> {
    const copy = await sendMessage<UserScriptRecord | null>(USER_SCRIPTS_ACTIONS.DUPLICATE, {
      id: script.id,
    });
    if (copy) {
      scripts = await sendMessage<UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST);
      showStatus(`Duplicated as "${copy.meta.name}"`);
    }
  }

  async function remove(script: UserScriptRecord): Promise<void> {
    if (!confirm(`Delete "${script.meta.name}" and its run history?`)) return;
    const ok = await sendMessage<boolean>(USER_SCRIPTS_ACTIONS.DELETE, { id: script.id });
    if (ok) {
      scripts = scripts.filter((s) => s.id !== script.id);
      showStatus("Script deleted");
    }
  }

  async function move(script: UserScriptRecord, dir: -1 | 1): Promise<void> {
    const idx = scripts.findIndex((s) => s.id === script.id);
    const target = idx + dir;
    if (target < 0 || target >= scripts.length) return;
    scripts = await sendMessage<UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.MOVE, {
      id: script.id,
      index: target,
    });
  }

  // ---- Editor ----

  function startEditing(script: UserScriptRecord): void {
    editingId = script.id;
    draftCode = script.code;
    draftDirty = false;
    expandedId = script.id;
  }

  function cancelEditing(): void {
    editingId = null;
    draftDirty = false;
  }

  function onDraftInput(): void {
    draftDirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    // UI-02: debounced auto-save (1s).
    saveTimer = setTimeout(() => void saveDraft(), 1000);
  }

  async function saveDraft(): Promise<void> {
    if (!editingId || !draftDirty) return;
    const script = scripts.find((s) => s.id === editingId);
    if (!script) return;
    try {
      const saved = await sendMessage<UserScriptRecord>(USER_SCRIPTS_ACTIONS.SAVE, {
        record: { ...script, code: draftCode, updatedAt: Date.now() },
      });
      scripts = scripts.map((s) => (s.id === saved.id ? saved : s));
      draftDirty = false;
      showStatus("Saved");
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Save failed", true);
    }
  }

  // ---- Import / export ----

  async function importFromFile(file: File): Promise<void> {
    const code = await file.text();
    const meta = parseHeaderClient(code);
    const record = await sendMessage<UserScriptRecord>(USER_SCRIPTS_ACTIONS.IMPORT_FILE, {
      record: {
        id: `us_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        code,
        meta,
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastRunAt: null,
      },
    });
    scripts = [...scripts, record];
    showStatus(`Imported "${record.meta.name}"`);
  }

  function parseHeaderClient(code: string): UserScriptRecord["meta"] {
    const grab = (key: string): string => {
      const m = code.match(new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "im"));
      return m ? m[1].trim() : "";
    };
    const all = (key: string): string[] => {
      const out: string[] = [];
      const re = new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, "gim");
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) out.push(m[1].trim());
      return out;
    };
    return {
      name: grab("name") || file_name_fallback || "Imported script",
      namespace: grab("namespace"),
      version: grab("version") || "0.0.0",
      description: grab("description"),
      matches: all("match").length ? all("match") : ["*://*/*"],
      excludes: all("exclude"),
      runAt: (grab("run-at") as UserScriptRecord["meta"]["runAt"]) || "document-idle",
      grants: all("grant"),
      requires: all("require"),
      resources: {},
      injectInto: grab("inject-into") === "page" ? "page" : "content",
      connects: all("connect"),
      updateURL: grab("updateURL"),
      downloadURL: grab("downloadURL"),
      icon: grab("icon64") || grab("icon"),
    };
  }

  let file_name_fallback = "";

  async function onImportPick(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file_name_fallback = file.name.replace(/\.user\.js$|\.js$/i, "");
    await importFromFile(file);
    input.value = "";
  }

  async function installFromUrl(): Promise<void> {
    const url = installUrl.trim();
    if (!url) return;
    installing = true;
    try {
      const record = await sendMessage<UserScriptRecord>(USER_SCRIPTS_ACTIONS.INSTALL_FROM_URL, {
        url,
      });
      scripts = [...scripts, record];
      installUrl = "";
      showStatus(`Installed "${record.meta.name}"`);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Install failed", true);
    } finally {
      installing = false;
    }
  }

  async function exportAll(): Promise<void> {
    const json = await sendMessage<string>(USER_SCRIPTS_ACTIONS.EXPORT);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "user-scripts-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportScript(script: UserScriptRecord): Promise<void> {
    const blob = new Blob([script.code], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${slugify(script.meta.name) || "script"}.user.js`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- Run log ----

  async function toggleLogs(script: UserScriptRecord): Promise<void> {
    if (expandedId === script.id) {
      expandedId = null;
      return;
    }
    expandedId = script.id;
    try {
      const logs = await sendMessage<UserScriptRunLogEntry[]>("user_scripts:run_log", {
        scriptId: script.id,
      });
      runLogs = { ...runLogs, [script.id]: logs };
    } catch {
      runLogs = { ...runLogs, [script.id]: [] };
    }
  }

  async function runInTab(script: UserScriptRecord): Promise<void> {
    try {
      const [tab] = await browser_queryActive();
      if (!tab?.id) throw new Error("No active tab");
      const count = await sendMessage<number>(USER_SCRIPTS_ACTIONS.RUN_IN_TAB, { tabId: tab.id });
      showStatus(count > 0 ? `Ran ${count} script(s) in tab` : "No matching scripts for this tab");
      await toggleLogsRefresh(script);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Run failed", true);
    }
  }

  async function toggleLogsRefresh(script: UserScriptRecord): Promise<void> {
    expandedId = script.id;
    const logs = await sendMessage<UserScriptRunLogEntry[]>("user_scripts:run_log", {
      scriptId: script.id,
    }).catch(() => [] as UserScriptRunLogEntry[]);
    runLogs = { ...runLogs, [script.id]: logs };
  }

  function browser_queryActive(): Promise<{ id?: number }[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs));
    });
  }

  function fmtTime(ts: number): string {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<div class="flex flex-col gap-2 p-2">
  {#if status}
    <div
      class="rounded-md border-[1.5px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#1A1A1A] {status.isError
        ? 'border-[#A82624] bg-ext-danger text-white'
        : 'border-[#1E6B38] bg-ext-success text-white'}"
    >
      {status.text}
    </div>
  {/if}

  <!-- Add Script Card -->
  <Card title="Add Script">
    <div class="flex flex-col gap-2">
      <!-- Install from URL -->
      <div class="flex items-center gap-1.5">
        <input
          class="h-7 min-w-0 flex-1 rounded-md border-[1.5px] border-ext-border bg-ext-surface px-2.5 text-[11.5px] font-medium text-ext-text outline-none placeholder:text-ext-muted transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
          placeholder="Install from URL (.user.js)..."
          bind:value={installUrl}
          onkeydown={(e) => e.key === "Enter" && void installFromUrl()}
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={installing || !installUrl.trim()}
          onclick={installFromUrl}
        >
          {installing ? "..." : "Install"}
        </Button>
      </div>

      <!-- Create blank script -->
      <div class="flex items-center gap-1.5">
        <input
          class="h-7 min-w-0 flex-1 rounded-md border-[1.5px] border-ext-border bg-ext-surface px-2.5 text-[11.5px] font-medium text-ext-text outline-none placeholder:text-ext-muted transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
          placeholder="New script name..."
          bind:value={newScriptName}
          onkeydown={(e) => e.key === "Enter" && void createScript()}
        />
        <Button
          size="sm"
          variant="primary"
          disabled={!newScriptName.trim()}
          onclick={createScript}
        >
          Create
        </Button>
      </div>
    </div>
  </Card>

  <!-- Script List Header Bar -->
  <div class="flex h-6 shrink-0 items-center justify-between px-1 pt-1">
    <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ext-muted">
      <span>Scripts</span>
      <span class="rounded-sm border border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-0.2 text-[10px] font-bold text-ext-text-secondary">
        {scripts.length}
      </span>
    </div>
    <div class="flex items-center gap-1.5">
      <input
        bind:this={fileInput}
        type="file"
        accept=".user.js,.js,text/javascript"
        class="hidden"
        onchange={onImportPick}
      />
      <button
        type="button"
        class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface px-2 text-[10px] font-bold uppercase tracking-wider text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] active:translate-x-px active:translate-y-px"
        onclick={() => fileInput?.click()}
        title="Import script from file"
      >
        <Icon name="download" size={11} class="rotate-180" />
        <span>Import</span>
      </button>
      <button
        type="button"
        class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-ext-border bg-ext-surface px-2 text-[10px] font-bold uppercase tracking-wider text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] active:translate-x-px active:translate-y-px"
        onclick={exportAll}
        title="Backup all scripts"
      >
        <Icon name="download" size={11} />
        <span>Export</span>
      </button>
    </div>
  </div>

  <!-- Script list -->
  {#if isLoading}
    <div class="py-8 text-center text-xs font-medium text-ext-muted">Loading scripts…</div>
  {:else if scripts.length === 0}
    <EmptyState
      title="No scripts yet"
      subtitle="Create a new script, import a .user.js file, or install from a URL."
    >
      {#snippet icon()}
        <Icon name="puzzle" size={28} />
      {/snippet}
    </EmptyState>
  {:else}
    <div class="flex flex-col gap-2">
      {#each scripts as script, i (script.id)}
        <div class="ext-card flex flex-col gap-2 rounded-lg border-[1.5px] border-ext-border bg-ext-surface p-2.5 shadow-[2px_2px_0_#1A1A1A]">
          <!-- Row 1: Priority + Name & Details + Toggle -->
          <div class="flex items-start gap-2">
            <!-- Priority Up/Down -->
            <div class="flex flex-col pt-0.5">
              <button
                type="button"
                class="cursor-pointer text-[10px] leading-none text-ext-muted transition-colors hover:text-ext-text disabled:cursor-not-allowed disabled:opacity-25"
                disabled={i === 0}
                onclick={() => move(script, -1)}
                title="Move up (higher priority)"
              >▲</button>
              <button
                type="button"
                class="cursor-pointer text-[10px] leading-none text-ext-muted transition-colors hover:text-ext-text disabled:cursor-not-allowed disabled:opacity-25"
                disabled={i === scripts.length - 1}
                onclick={() => move(script, 1)}
                title="Move down (lower priority)"
              >▼</button>
            </div>

            <!-- Title & domain matches -->
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="truncate text-xs font-bold text-ext-text" title={script.meta.name}>
                  {script.meta.name}
                </span>
                <Badge text={`v${script.meta.version}`} variant="neutral" />
              </div>
              <div class="truncate text-[10.5px] text-ext-muted" title={script.meta.matches.join(", ")}>
                {script.meta.matches.join(", ")}
              </div>
            </div>

            <!-- Neo-Brutalist Toggle -->
            <Toggle
              checked={script.enabled}
              label={`Toggle ${script.meta.name}`}
              onchange={(v) => toggle(script, v)}
            />
          </div>

          <!-- Row 2: Action Toolbar (Responsive, doesn't crowd Title) -->
          <div class="flex flex-wrap items-center justify-between gap-1 border-t border-ext-border/30 pt-1.5">
            <!-- Main Actions: Edit, Run, Log -->
            <div class="flex items-center gap-1">
              <Button
                variant={editingId === script.id ? "primary" : "secondary"}
                size="sm"
                icon="markdown"
                onclick={() => (editingId === script.id ? cancelEditing() : startEditing(script))}
                title="Edit script code"
              >
                Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="refresh"
                onclick={() => runInTab(script)}
                title="Run script in active tab"
              >
                Run
              </Button>
              <Button
                variant={expandedId === script.id ? "secondary" : "ghost"}
                size="sm"
                icon="star"
                onclick={() => toggleLogs(script)}
                title="Toggle execution log"
              >
                Log
              </Button>
            </div>

            <!-- Secondary Actions: Duplicate, Export, Delete -->
            <div class="flex items-center gap-0.5">
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] border-[1px] border-transparent text-ext-muted transition-all hover:border-ext-border hover:bg-[#EDE7DA] hover:text-ext-text"
                onclick={() => duplicate(script)}
                title="Duplicate script"
              >
                <Icon name="copy" size={13} />
              </button>
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] border-[1px] border-transparent text-ext-muted transition-all hover:border-ext-border hover:bg-[#EDE7DA] hover:text-ext-text"
                onclick={() => exportScript(script)}
                title="Export as .user.js"
              >
                <Icon name="download" size={13} />
              </button>
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] border-[1px] border-transparent text-ext-danger transition-all hover:border-[#A82624]/30 hover:bg-ext-danger/10"
                onclick={() => remove(script)}
                title="Delete script"
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          </div>

          <!-- Run Logs Accordion -->
          {#if expandedId === script.id}
            <div class="rounded-md border border-ext-border bg-ext-bg p-2 text-[11px]">
              <div class="mb-1.5 flex items-center justify-between">
                <span class="text-[10px] font-bold uppercase tracking-wider text-ext-muted">
                  Run log ({(runLogs[script.id] ?? []).length})
                </span>
                <span class="text-[10px] text-ext-muted">
                  Last: {script.lastRunAt ? fmtTime(script.lastRunAt) : "never"}
                </span>
              </div>
              {#if (runLogs[script.id] ?? []).length === 0}
                <div class="py-1 text-center text-ext-muted">No runs recorded yet.</div>
              {:else}
                <ul class="flex max-h-36 flex-col gap-1 overflow-y-auto pr-1">
                  {#each runLogs[script.id] ?? [] as log}
                    <li class="flex items-center gap-1.5 text-[10.5px]">
                      <span class={log.ok ? "font-bold text-ext-success" : "font-bold text-ext-danger"}>
                        {log.ok ? "✓" : "✗"}
                      </span>
                      <span class="min-w-0 flex-1 truncate text-ext-muted" title={log.url}>{log.url}</span>
                      <span class="shrink-0 text-[10px] text-ext-muted">{fmtTime(log.ts)}</span>
                      {#if log.message}
                        <span class="truncate text-ext-danger" title={log.message}>{log.message}</span>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}

          <!-- Code Editor -->
          {#if editingId === script.id}
            <div class="flex flex-col gap-1.5 rounded-md border border-ext-border bg-ext-bg p-2">
              <textarea
                class="h-56 w-full resize-y rounded-md border-[1.5px] border-ext-border bg-[#FFFDF7] p-2 font-mono text-[11px] leading-relaxed text-ext-text outline-none transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
                spellcheck="false"
                bind:value={draftCode}
                oninput={onDraftInput}
              ></textarea>
              <div class="flex flex-wrap items-center justify-between gap-1">
                <span class="text-[10px] text-ext-muted">
                  {draftDirty ? "Unsaved changes (auto-saves 1s)" : "Saved"}
                </span>
                <div class="flex gap-1.5">
                  <Button size="sm" variant="ghost" onclick={cancelEditing}>Close</Button>
                  <Button size="sm" variant="primary" onclick={saveDraft} disabled={!draftDirty}>Save now</Button>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
