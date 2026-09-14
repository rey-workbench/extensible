<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "wxt/browser";
  import Button from "@/components/Button.svelte";
  import Card from "@/components/Card.svelte";
  import EmptyState from "@/components/EmptyState.svelte";
  import Icon from "@/components/Icon.svelte";
  import { slugify } from "@/lib/browser";
  import { sendMessage } from "@/lib/messaging";
  import { showToast } from "@/lib/toast";
  import { createUniqueId } from "@/lib/utils";
  import { USER_SCRIPTS_ACTIONS } from "../constants/user-scripts.constants";
  import {
    duplicate,
    list,
    move,
    remove as removeScript,
    save,
    scriptsItem,
    setEnabled,
  } from "../services/user-scripts.service";
  import type { UserScriptRecord, UserScriptRunLogEntry } from "../types/user-scripts.types";
  import { makeScriptTemplate, parseUserScriptHeader } from "../utils/header-parser.utils";
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

  const isDashboard = $derived(
    typeof window !== "undefined" && window.location.pathname.includes("dashboard"),
  );

  function handleEdit(script: UserScriptRecord): void {
    if (isDashboard) {
      if (editingId === script.id) {
        cancelEditing();
      } else {
        startEditing(script);
      }
    } else {
      void openFullDashboard(script.id);
    }
  }

  async function openFullDashboard(editScriptId?: string): Promise<void> {
    const query = editScriptId ? `?editId=${encodeURIComponent(editScriptId)}` : "";
    const targetUrl = browser.runtime.getURL(`/dashboard.html${query}`);
    const allTabs = await browser.tabs.query({});
    const existingTab = allTabs.find((t) => t.url?.includes("/dashboard.html"));
    if (existingTab?.id != null) {
      await browser.tabs.update(existingTab.id, { url: targetUrl, active: true });
      if (existingTab.windowId != null) {
        await browser.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      await browser.tabs.create({ url: targetUrl });
    }
  }

  onMount(() => {
    void refresh();

    const unwatch = scriptsItem.watch((val) => {
      if (val) {
        scripts = val;
        isLoading = false;
      }
    });

    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get("installUrl");
    if (targetUrl) {
      installUrl = targetUrl;
      void inspectUrl(targetUrl);
    }
    const editId = params.get("editId");
    if (editId) {
      void (async () => {
        const all = await list();
        const found = all.find((s) => s.id === editId);
        if (found) startEditing(found);
      })();
    }

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
      const res = await fetch(url, { credentials: "omit", signal: controller.signal });
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
      showStatus(err instanceof Error ? err.message : "Failed to load script", true);
    } finally {
      clearTimeout(timer);
      installing = false;
    }
  }

  async function confirmInstall(): Promise<void> {
    if (!pendingInstall) return;
    installing = true;
    try {
      const record = recordFromCode(pendingInstall.code);
      await save(record);
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
        scripts = await sendMessage<UserScriptRecord[]>(USER_SCRIPTS_ACTIONS.LIST);
      } catch (err) {
        showStatus(err instanceof Error ? err.message : "Failed to load scripts", true);
      }
    } finally {
      isLoading = false;
    }
  }

  function showStatus(text: string, isError = false): void {
    if (rootEl) showToast(rootEl, text, { isError });
  }

  async function toggle(script: UserScriptRecord, enabled: boolean): Promise<void> {
    scripts = await setEnabled(script.id, enabled);
    void sendMessage(USER_SCRIPTS_ACTIONS.TOGGLE, { id: script.id, enabled }).catch(() => {});
  }

  async function createScript(): Promise<void> {
    const name = newScriptName.trim() || "New script";
    newScriptName = "";
    const record = recordFromCode(makeScriptTemplate(name));
    await save(record);
    scripts = [...scripts, record];
    if (isDashboard) {
      startEditing(record);
    } else {
      void openFullDashboard(record.id);
    }
  }

  async function duplicateScript(script: UserScriptRecord): Promise<void> {
    const copy = await duplicate(script.id);
    if (copy) {
      scripts = await list();
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
    const ok = await removeScript(script.id);
    if (ok) {
      scripts = scripts.filter((s) => s.id !== script.id);
      showStatus("Script deleted");
      void sendMessage(USER_SCRIPTS_ACTIONS.DELETE, { id: script.id }).catch(() => {});
    }
  }

  async function moveItem(script: UserScriptRecord, dir: -1 | 1): Promise<void> {
    const idx = scripts.findIndex((s) => s.id === script.id);
    const target = idx + dir;
    if (target < 0 || target >= scripts.length) return;
    scripts = await move(script.id, target);
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
      const saved = await save({ ...script, code: draftCode, updatedAt: Date.now() });
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
    const logs = await sendMessage<UserScriptRunLogEntry[]>(USER_SCRIPTS_ACTIONS.RUN_LOG, {
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

<div bind:this={rootEl} class="flex flex-col gap-3 p-1.5 sm:p-2 w-full max-w-full overflow-x-hidden box-border">
  {#if pendingInstall}
    <div class="rounded-lg border-[1.5px] border-solid border-amber-600/50 bg-amber-500/10 p-2.5 shadow-[1.5px_1.5px_0_#1A1A1A] w-full max-w-full overflow-hidden">
      <div class="flex items-center justify-between">
        <span class="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
          Auto-Captured UserScript
        </span>
        <span class="text-[10.5px] font-mono text-ext-text-secondary">v{pendingInstall.version}</span>
      </div>

      <h4 class="mt-2 text-[12.5px] font-bold text-ext-text truncate">{pendingInstall.name}</h4>
      <p class="mt-0.5 text-[10.5px] text-ext-text-secondary line-clamp-2">{pendingInstall.description}</p>
      {#if pendingInstall.namespace}
        <div class="mt-1 text-[9.5px] text-ext-muted truncate">Namespace: {pendingInstall.namespace}</div>
      {/if}

      <div class="mt-2 space-y-1">
        <div class="font-bold uppercase tracking-wider text-ext-text-secondary text-[9px]">Applies To:</div>
        <div class="flex flex-wrap gap-1 max-h-14 overflow-y-auto">
          {#each pendingInstall.matches as m}
            <span class="rounded bg-[#EDE7DA] px-1 py-0.2 font-mono text-[8.5px] text-ext-text border border-ext-border/40 truncate max-w-[180px]">{m}</span>
          {/each}
        </div>
      </div>

      <div class="mt-2.5 flex items-center justify-end gap-2 border-t border-solid border-amber-600/20 pt-2">
        <Button size="sm" variant="secondary" onclick={cancelInstall} disabled={installing} class="h-6 px-2 text-[10.5px]">
          Cancel
        </Button>
        <Button size="sm" variant="primary" onclick={confirmInstall} disabled={installing} class="h-6 px-2 text-[10.5px]">
          {installing ? "Installing..." : "Install Script"}
        </Button>
      </div>
    </div>
  {/if}

  <div class="w-full max-w-full {isDashboard ? 'flex flex-col lg:flex-row gap-4 items-start' : 'flex flex-col gap-3'}">
    <!-- Left Column: Add Script + Script List -->
    <div class="{isDashboard ? 'w-full lg:w-[380px] lg:shrink-0' : 'w-full'} flex flex-col gap-2.5 min-w-0">
      <Card title="Add Script">
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-1.5 w-full">
            <input
              class="h-7 w-0 flex-1 min-w-0 rounded-md border-[1.5px] border-solid border-ext-border bg-ext-surface px-2 text-[11px] font-medium text-ext-text outline-none placeholder:text-ext-muted transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
              placeholder="Install from URL (.user.js)..."
              bind:value={installUrl}
              onkeydown={(e) => e.key === "Enter" && void installFromUrl()}
            />
            <Button
              size="sm"
              variant="secondary"
              class="h-7 shrink-0 px-2.5 text-[10.5px]"
              disabled={installing || !installUrl.trim()}
              onclick={installFromUrl}
            >
              {installing ? "..." : "Install"}
            </Button>
          </div>

          <div class="flex items-center gap-1.5 w-full">
            <input
              class="h-7 w-0 flex-1 min-w-0 rounded-md border-[1.5px] border-solid border-ext-border bg-ext-surface px-2 text-[11px] font-medium text-ext-text outline-none placeholder:text-ext-muted transition-all focus:border-ext-primary focus:ring-2 focus:ring-ext-primary/20"
              placeholder="New script name..."
              bind:value={newScriptName}
              onkeydown={(e) => e.key === "Enter" && newScriptName.trim() && void createScript()}
            />
            <Button
              size="sm"
              variant="primary"
              class="h-7 shrink-0 px-2.5 text-[10.5px]"
              disabled={!newScriptName.trim()}
              onclick={createScript}
            >
              Create
            </Button>
          </div>
        </div>
      </Card>

      <div class="flex h-6 shrink-0 items-center justify-between px-0.5 pt-0.5">
        <div class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ext-muted">
          <span>Scripts</span>
          <span class="rounded-sm border border-solid border-[#D4CEC2] bg-[#EDE7DA] px-1.5 py-0.2 text-[10px] font-bold text-ext-text-secondary">
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
            class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] active:translate-x-px active:translate-y-px"
            onclick={() => fileInput?.click()}
            title="Import script from file"
          >
            <Icon name="download" size={10} class="rotate-180" />
            <span>Import</span>
          </button>
          <button
            type="button"
            class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-solid border-ext-border bg-ext-surface px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-ext-text shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-[#EDE7DA] active:translate-x-px active:translate-y-px"
            onclick={exportAll}
            title="Backup all scripts"
          >
            <Icon name="download" size={10} />
            <span>Export</span>
          </button>
          {#if !isDashboard}
            <button
              type="button"
              class="inline-flex h-5.5 cursor-pointer items-center gap-1 rounded-[5px] border-[1.5px] border-solid border-ext-border bg-amber-500/10 px-1.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-700 shadow-[1px_1px_0_#1A1A1A] transition-all hover:bg-amber-500/20 active:translate-x-px active:translate-y-px"
              onclick={() => void openFullDashboard()}
              title="Open full dashboard in new tab"
            >
              <span>Dashboard ↗</span>
            </button>
          {/if}
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
            <div class="ext-card overflow-hidden rounded-lg transition-all {editingId === script.id ? 'ring-2 ring-ext-primary ring-offset-1 shadow-md' : ''}">
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

    {#if isDashboard}
      <!-- Right Column: Wide Code Editor (Dashboard Only) -->
      <div class="w-full flex-1 min-w-0">
        {#if editingScript}
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
          <div class="flex flex-col items-center justify-center min-h-[480px] rounded-xl border-[1.5px] border-dashed border-ext-border bg-ext-surface/60 p-8 text-center shadow-[1.5px_1.5px_0_#1A1A1A]">
            <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-solid border-ext-border bg-[#EDE7DA] text-ext-text mb-3 shadow-[1.5px_1.5px_0_#1A1A1A]">
              <Icon name="puzzle" size={24} />
            </div>
            <h3 class="text-sm font-bold uppercase tracking-wider text-ext-text">UserScript Workspace</h3>
            <p class="mt-1 text-xs text-ext-text-secondary max-w-sm">
              Select an installed script on the left to edit code, or create a new script.
            </p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>