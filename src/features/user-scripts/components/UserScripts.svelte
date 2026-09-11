<script lang="ts">
  import { onMount } from "svelte";
  import Button from "@/components/Button.svelte";
  import Card from "@/components/Card.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import { slugify } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { createUniqueId } from "@/lib/utils";
  import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
  import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
  import { parseUserScriptHeader } from "../utils/header-parser.utils";
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
  let installUrl = $state("");
  let installing = $state(false);
  let newScriptName = $state("");
  let fileInput = $state<HTMLInputElement | null>(null);
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

  async function importFromFile(file: File): Promise<void> {
    const code = await file.text();
    const fallbackName = file.name.replace(/\.user\.js$|\.js$/i, "");
    const meta = parseUserScriptHeader(code, fallbackName);
    const record = await sendMessage<UserScriptRecord>(USER_SCRIPTS_ACTIONS.IMPORT_FILE, {
      record: {
        id: createUniqueId("us"),
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
      if (editingId === script.id && draftDirty) {
        await saveDraft();
      }
      const count = await sendMessage<number>(USER_SCRIPTS_ACTIONS.RUN_IN_TAB, {
        scriptId: script.id,
      });
      showStatus(count > 0 ? `Ran ${count} script(s) in tab` : "No matching scripts for this tab");
      expandedId = script.id;
      await loadRunLog(script);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Run failed", true);
    }
  }
</script>

<div class="flex flex-col gap-2.5 p-2.5">
  {#if status}
    <div
      class="rounded-md border-[1.5px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-[2px_2px_0_#1A1A1A] {status.isError
        ? 'border-[#A82624] bg-ext-danger text-white'
        : 'border-[#1E6B38] bg-ext-success text-white'}"
    >
      {status.text}
    </div>
  {/if}

  <Card title="Add Script">
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-1.5">
        <input
          class="h-7 min-w-0 flex-1 rounded-md border-[1.5px] border-solid border-ext-border bg-ext-surface px-2.5 text-[11.5px] font-medium text-ext-text outline-none placeholder:text-ext-muted transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
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

      <div class="flex items-center gap-1.5">
        <input
          class="h-7 min-w-0 flex-1 rounded-md border-[1.5px] border-solid border-ext-border bg-ext-surface px-2.5 text-[11.5px] font-medium text-ext-text outline-none placeholder:text-ext-muted transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
          placeholder="New script name..."
          bind:value={newScriptName}
          onkeydown={(e) => e.key === "Enter" && newScriptName.trim() && void createScript()}
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

  <div class="flex h-6 shrink-0 items-center justify-between px-1 pt-0.5">
    <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ext-muted">
      <span>Scripts</span>
      <span class="rounded-sm border border-solid border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-0.2 text-[10px] font-bold text-ext-text-secondary">
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
        class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface px-2 text-[10px] font-bold uppercase tracking-wider text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] active:translate-x-px active:translate-y-px"
        onclick={() => fileInput?.click()}
        title="Import script from file"
      >
        <Icon name="download" size={11} class="rotate-180" />
        <span>Import</span>
      </button>
      <button
        type="button"
        class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface px-2 text-[10px] font-bold uppercase tracking-wider text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] active:translate-x-px active:translate-y-px"
        onclick={exportAll}
        title="Backup all scripts"
      >
        <Icon name="download" size={11} />
        <span>Export</span>
      </button>
    </div>
  </div>

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
            onEdit={() => (editingId === script.id ? cancelEditing() : startEditing(script))}
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
</div>