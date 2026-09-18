<script lang="ts">
  import { onMount } from "svelte";
  import Button from "@/components/Button.svelte";
  import Card from "@/components/Card.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import { slugify } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { showToast } from "@/lib/toast";

  import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
  import { list, sanitizeRecord, scriptsItem } from "../services/user-scripts.service";
  import type {
    UserScriptRecord,
    UserScriptRunLogEntry,
  } from "../types/user-scripts.types";
  import {
    makeScriptTemplate,
    parseUserScriptHeader,
  } from "../utils/header-parser.utils";
  import { recordFromCode } from "../utils/record-factory.utils";
  import ScriptEditor from "./ScriptEditor.svelte";
  import ScriptRow from "./ScriptRow.svelte";

  let rootEl = $state<HTMLElement | null>(null);
  let scripts = $state<UserScriptRecord[]>([]);
  let isLoading = $state(true);
  let deleteConfirmId = $state<string | null>(null);
  let deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null;
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

  interface PendingInstall {
    url: string;
    code: string;
    name: string;
    version: string;
    description: string;
    namespace: string;
    matches: string[];
  }
  let pendingInstall = $state<PendingInstall | null>(null);

  const editingScript = $derived(
    editingId ? (scripts.find((s) => s.id === editingId) ?? null) : null,
  );

  
  const isExpanded = $derived(
    typeof window !== "undefined" &&
      !window.location.pathname.includes("popup"),
  );

  function handleEdit(script: UserScriptRecord): void {
    if (editingId === script.id) {
      cancelEditing();
    } else {
      startEditing(script);
    }
  }

  
  export function openEditorFor(scriptId: string): void {
    void (async () => {
      const all = await sendMessage<UserScriptRecord[]>(
        USER_SCRIPTS_ACTIONS.LIST,
      );
      const found = all.find((s) => s.id === scriptId);
      if (found) startEditing(found);
    })();
  }

  
  export function installFromCapturedUrl(url: string): void {
    installUrl = url;
    void inspectUrl(url);
  }

  onMount(() => {
    void refresh();

    const unwatch = scriptsItem.watch((val) => {
      if (val) {
        scripts = val.map(sanitizeRecord);
        isLoading = false;
      }
    });

    return () => {
      unwatch?.();
    };
  });

  async function inspectUrl(url: string): Promise<void> {
    installing = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      showStatus("Fetching script from URL...", false);
      const res = await fetch(url, {
        credentials: "omit",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const code = await res.text();
      const meta = parseUserScriptHeader(code, "Incoming Script");
      pendingInstall = {
        url,
        code,
        name: meta.name,
        version: meta.version || "1.0.0",
        description: meta.description || "No description provided",
        namespace: meta.namespace || "",
        matches: meta.matches.length > 0 ? meta.matches : ["<all_urls>"],
      };
      showStatus(`Loaded "${meta.name}"`);
    } catch (err) {
      showStatus(
        err instanceof Error ? err.message : "Failed to load script",
        true,
      );
    } finally {
      clearTimeout(timer);
      installing = false;
    }
  }

  async function confirmInstall(): Promise<void> {
    if (!pendingInstall) return;
    installing = true;
    try {
      const record = await sendMessage<UserScriptRecord>(
        USER_SCRIPTS_ACTIONS.SAVE,
        {
          record: recordFromCode(pendingInstall.code),
        },
      );
      scripts = [...scripts, record];
      showStatus(`Installed "${record.meta.name}"`);
      pendingInstall = null;
      installUrl = "";
      const url = new URL(window.location.href);
      url.searchParams.delete("installUrl");
      window.history.replaceState({}, "", url.toString());
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Install failed", true);
    } finally {
      installing = false;
    }
  }

  function cancelInstall(): void {
    pendingInstall = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("installUrl");
    window.history.replaceState({}, "", url.toString());
  }

  async function refresh(): Promise<void> {
    try {
      scripts = await list();
    } catch {
      try {
        scripts = (
          await sendMessage<UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST)
        ).map(sanitizeRecord);
      } catch (err) {
        showStatus(
          err instanceof Error ? err.message : "Failed to load scripts",
          true,
        );
      }
    } finally {
      isLoading = false;
    }
  }

  function showStatus(text: string, isError = false): void {
    if (rootEl) showToast(rootEl, text, { isError });
  }

  async function toggle(
    script: UserScriptRecord,
    enabled: boolean,
  ): Promise<void> {
    try {
      scripts = await sendMessage<UserScriptRecord[]>(
        USER_SCRIPTS_ACTIONS.TOGGLE,
        {
          id: script.id,
          enabled,
        },
      );
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Toggle failed", true);
    }
  }

  async function createScript(): Promise<void> {
    const name = newScriptName.trim() || "New script";
    newScriptName = "";
    const record = await sendMessage<UserScriptRecord>(
      USER_SCRIPTS_ACTIONS.SAVE,
      {
        record: recordFromCode(makeScriptTemplate(name)),
      },
    );
    scripts = [...scripts, record];
    startEditing(record);
  }

  async function duplicateScript(script: UserScriptRecord): Promise<void> {
    const copy = await sendMessage<UserScriptRecord | null>(
      USER_SCRIPTS_ACTIONS.DUPLICATE,
      {
        id: script.id,
      },
    );
    if (copy) {
      scripts = await sendMessage<UserScriptRecord[]>(
        USER_SCRIPTS_ACTIONS.LIST,
      );
      showStatus(`Duplicated as "${copy.meta.name}"`);
    }
  }

  async function remove(script: UserScriptRecord): Promise<void> {
    if (deleteConfirmId !== script.id) {
      deleteConfirmId = script.id;
      showStatus(`Click delete again to confirm "${script.meta.name}"`, true);
      if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
      deleteConfirmTimer = setTimeout(() => {
        if (deleteConfirmId === script.id) deleteConfirmId = null;
      }, 3000);
      return;
    }
    deleteConfirmId = null;
    const ok = await sendMessage<boolean>(USER_SCRIPTS_ACTIONS.DELETE, {
      id: script.id,
    });
    if (ok) {
      scripts = scripts.filter((s) => s.id !== script.id);
      showStatus("Script deleted");
    }
  }

  async function moveItem(
    script: UserScriptRecord,
    dir: -1 | 1,
  ): Promise<void> {
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
      const saved = await sendMessage<UserScriptRecord>(
        USER_SCRIPTS_ACTIONS.SAVE,
        {
          record: { ...script, code: draftCode, updatedAt: Date.now() },
        },
      );
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
    const record = await sendMessage<UserScriptRecord>(
      USER_SCRIPTS_ACTIONS.SAVE,
      {
        record: recordFromCode(code, fallbackName),
      },
    );
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
    await inspectUrl(url);
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
    const logs = await sendMessage<UserScriptRunLogEntry[]>(
      USER_SCRIPTS_ACTIONS.RUN_LOG,
      {
        scriptId: script.id,
      },
    ).catch(() => [] as UserScriptRunLogEntry[]);
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
      showStatus(
        count > 0
          ? `Ran ${count} script(s) in tab`
          : "No matching scripts for this tab",
      );
      expandedId = script.id;
      await loadRunLog(script);
    } catch (err) {
      showStatus(err instanceof Error ? err.message : "Run failed", true);
    }
  }
</script>

<div
  bind:this={rootEl}
  class="flex flex-col gap-4 p-2.5 sm:p-3.5 w-full max-w-full overflow-x-hidden box-border"
>
  {#if pendingInstall}      <div
      class="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-3 shadow-sm w-full max-w-full overflow-hidden"
    >
      <div class="flex items-center justify-between">
        <span
          class="rounded-full bg-amber-400 px-2.5 py-0.5 text-label font-bold uppercase tracking-wider text-[#0f172a] shadow-sm"
        >
          Auto-Captured UserScript
        </span>
        <span class="text-xs font-mono text-ext-text-secondary"
          >v{pendingInstall.version}</span
        >
      </div>

      <h4 class="mt-2 text-body-lg font-bold text-ext-text truncate">
        {pendingInstall.name}
      </h4>
      <p class="mt-0.5 text-xs text-ext-text-secondary line-clamp-2">
        {pendingInstall.description}
      </p>
      {#if pendingInstall.namespace}
        <div class="mt-1 text-label text-ext-muted truncate">
          Namespace: {pendingInstall.namespace}
        </div>
      {/if}

      <div class="mt-2 space-y-1">
        <div
          class="font-bold uppercase tracking-wider text-ext-text-secondary text-label"
        >
          Applies To:
        </div>
        <div class="flex flex-wrap gap-1.5 max-h-14 overflow-y-auto">
          {#each pendingInstall.matches as m}
            <span
              class="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 font-mono text-label text-ext-text-secondary truncate max-w-45"
              >{m}</span
            >
          {/each}
        </div>
      </div>

      <div
        class="mt-2.5 flex items-center justify-end gap-2 border-t border-amber-200/50 pt-2.5"
      >
        <Button
          size="sm"
          variant="secondary"
          onclick={cancelInstall}
          disabled={installing}
          class="h-7 px-2.5 text-label"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="primary"
          onclick={confirmInstall}
          disabled={installing}
          class="h-7 px-2.5 text-label"
        >
          {installing ? "Installing..." : "Install Script"}
        </Button>
      </div>
    </div>
  {/if}

  {#if isExpanded && editingScript}
    
    <ScriptEditor
      script={editingScript}
      bind:code={draftCode}
      dirty={draftDirty}
      onInput={onDraftInput}
      onSave={() => void saveDraft()}
      onClose={cancelEditing}
      onRun={() => void runInTab(editingScript)}
    />
  {:else}
  <div class="flex w-full max-w-full flex-col gap-3">
    
    <div class="flex w-full flex-col gap-2.5 min-w-0">
      <Card title="Add Script">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-1.5 w-full">
            <input
              class="ext-field h-9 w-0 flex-1 min-w-0 rounded-lg px-3 text-body font-medium"
              placeholder="Install from URL (.user.js)..."
              bind:value={installUrl}
              onkeydown={(e) => e.key === "Enter" && void installFromUrl()}
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-9 shrink-0 px-3.5"
              disabled={installing || !installUrl.trim()}
              onclick={installFromUrl}
            >
              {installing ? "..." : "Install"}
            </Button>
          </div>

          <div class="flex items-center gap-1.5 w-full">
            <input
              class="ext-field h-9 w-0 flex-1 min-w-0 rounded-lg px-3 text-body font-medium"
              placeholder="New script name..."
              bind:value={newScriptName}
              onkeydown={(e) =>
                e.key === "Enter" &&
                newScriptName.trim() &&
                void createScript()}
            />
            <Button
              size="sm"
              variant="primary"
              class="h-9 shrink-0 px-3.5"
              disabled={!newScriptName.trim()}
              onclick={createScript}
            >
              Create
            </Button>
          </div>
        </div>
      </Card>

      <div class="flex h-7 shrink-0 items-center justify-between px-1 pt-1">
        <div
          class="flex items-center gap-1.5 text-label font-bold uppercase tracking-widest text-ext-muted"
        >
          <span>Scripts</span>
          <span
            class="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-label font-bold text-ext-text-secondary"
          >
            {scripts.length}
          </span>
        </div>
        <div class="flex items-center gap-1">
          <input
            bind:this={fileInput}
            type="file"
            accept=".user.js,.js,text/javascript"
            class="hidden"
            onchange={onImportPick}
          />
          <button
            type="button"
            class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-label font-bold uppercase tracking-wider text-ext-text shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-95"
            onclick={() => fileInput?.click()}
            title="Import script from file"
          >
            <Icon name="download" size={10} class="rotate-180" />
            <span>Import</span>
          </button>
          <button
            type="button"
            class="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-label font-bold uppercase tracking-wider text-ext-text shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-95"
            onclick={exportAll}
            title="Backup all scripts"
          >
            <Icon name="download" size={10} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {#if isLoading}
        <div class="py-8 text-center text-body font-medium text-ext-muted">
          Loading scripts…
        </div>
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
        <div class="flex flex-col gap-3">
          {#each scripts as script, i (script.id)}
            <div
              class="ext-card overflow-hidden rounded-lg transition-all {editingId ===
              script.id
                ? 'ring-2 ring-ext-primary ring-offset-1 shadow-md'
                : ''}"
            >
              <ScriptRow
                {script}
                index={i}
                total={scripts.length}
                runLogs={runLogs[script.id] ?? []}
                logOpen={expandedId === script.id}
                editing={editingId === script.id}
                onMove={(dir) => void moveItem(script, dir)}
                onToggle={(v) => void toggle(script, v)}
                onEdit={() => handleEdit(script)}
                onRun={() => void runInTab(script)}
                onToggleLogs={() => void toggleLogs(script)}
                onDuplicate={() => void duplicateScript(script)}
                onExport={() => void exportScript(script)}
                onDelete={() => void remove(script)}
              />
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  {/if}
</div>
