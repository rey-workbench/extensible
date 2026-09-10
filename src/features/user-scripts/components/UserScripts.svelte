<script lang="ts">
  import { onMount } from "svelte";
  import Button from "@/components/Button.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import SectionHeader from "@/components/SectionHeader.svelte";
  import { slugify } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
  import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
  import { parseImportedHeader } from "../utils/header-import.utils";
  import InstallBar from "./InstallBar.svelte";
  import NewScriptBar from "./NewScriptBar.svelte";
  import ScriptEditor from "./ScriptEditor.svelte";
  import ScriptRow from "./ScriptRow.svelte";

  let scripts = $state<UserScriptRecord[]>([]);
  let isLoading = $state(true);
  let status = $state<{ text: string; isError?: boolean } | null>(null);
  let statusTimer: ReturnType<typeof setTimeout> | null = null;
  let expandedId = $state<string | null>(null);
  let editingId = $state<string | null>(null);
  let draftCode = $state("");
  let draftDirty = $state(false);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let installing = $state(false);
  let runLogs = $state<Record<string, UserScriptRunLogEntry[]>>({});

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

  async function createScript(nameRaw: string): Promise<void> {
    const name = nameRaw || "New script";
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
    const fallbackName = file.name.replace(/\.user\.js$|\.js$/i, "");
    const meta = parseImportedHeader(code, fallbackName);
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

  async function onImportPick(e: Event): Promise<void> {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await importFromFile(file);
    input.value = "";
  }

  async function installFromUrl(url: string): Promise<void> {
    if (!url) return;
    installing = true;
    try {
      const record = await sendMessage<UserScriptRecord>(USER_SCRIPTS_ACTIONS.INSTALL_FROM_URL, {
        url,
      });
      scripts = [...scripts, record];
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
    await loadRunLog(script);
  }

  async function loadRunLog(script: UserScriptRecord): Promise<void> {
    const logs = await sendMessage<UserScriptRunLogEntry[]>("user_scripts:run_log", {
      scriptId: script.id,
    }).catch(() => [] as UserScriptRunLogEntry[]);
    runLogs = { ...runLogs, [script.id]: logs };
  }

  async function runInTab(script: UserScriptRecord): Promise<void> {
    try {
      const tabs = await new Promise<{ id?: number }[]>((resolve) =>
        chrome.tabs.query({ active: true, currentWindow: true }, (t) => resolve(t)),
      );
      const tab = tabs[0];
      if (!tab?.id) throw new Error("No active tab");
      const count = await sendMessage<number>(USER_SCRIPTS_ACTIONS.RUN_IN_TAB, { tabId: tab.id });
      showStatus(count > 0 ? `Ran ${count} script(s) in tab` : "No matching scripts for this tab");
      expandedId = script.id;
      await loadRunLog(script);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Run failed", true);
    }
  }
</script>

<div class="flex flex-col gap-3">
  <SectionHeader title="User Scripts">
    {#snippet action()}
      <Button variant="ghost" size="sm" onclick={exportAll} title="Export all scripts">
        <Icon name="download" size={14} />
      </Button>
      <label class="inline-flex cursor-pointer">
        <span class="sr-only">Import script</span>
        <input type="file" accept=".user.js,.js,text/javascript" class="hidden" onchange={onImportPick} />
        <span
          class="inline-flex h-7 items-center rounded-md border border-ext-border px-2 text-[11px] font-medium hover:bg-ext-surface-hover"
        >
          Import
        </span>
      </label>
    {/snippet}
  </SectionHeader>

  {#if status}
    <div
      class="rounded-md border px-2.5 py-1.5 text-[11px] {status.isError
        ? 'border-red-300 bg-red-50 text-red-700'
        : 'border-ext-border bg-ext-surface text-ext-text'}"
    >
      {status.text}
    </div>
  {/if}

  <!-- Install from URL -->
  <div class="ext-card overflow-hidden rounded-lg">
    <InstallBar {installing} onInstall={(url) => void installFromUrl(url)} />
  </div>

  <!-- Script list -->
  {#if isLoading}
    <div class="py-8 text-center text-[12px] text-ext-muted">Loading scripts…</div>
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
        <div class="ext-card overflow-hidden rounded-lg">
          <ScriptRow
            {script}
            index={i}
            total={scripts.length}
            runLogs={runLogs[script.id] ?? []}
            logOpen={expandedId === script.id}
            editing={editingId === script.id}
            onMove={(dir) => void move(script, dir)}
            onToggle={(v) => void toggle(script, v)}
            onEdit={() => startEditing(script)}
            onRun={() => void runInTab(script)}
            onToggleLogs={() => void toggleLogs(script)}
            onDuplicate={() => void duplicate(script)}
            onExport={() => void exportScript(script)}
            onDelete={() => void remove(script)}
          >
            {#snippet editor()}
              {#if editingId === script.id}
                <ScriptEditor
                  {script}
                  bind:code={draftCode}
                  dirty={draftDirty}
                  onInput={onDraftInput}
                  onSave={() => void saveDraft()}
                  onClose={cancelEditing}
                />
              {/if}
            {/snippet}
          </ScriptRow>
        </div>
      {/each}
    </div>
  {/if}

  <!-- New script -->
  <div class="ext-card overflow-hidden rounded-lg">
    <NewScriptBar onCreate={(name) => void createScript(name)} />
  </div>
</div>