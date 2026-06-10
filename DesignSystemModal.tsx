'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Download,
  CheckCircle2,
  AlertCircle,
  GitCompare,
  BookOpen,
  Sparkles,
  FileText,
  Palette,
  Check,
  Copy,
  ChevronRight,
  Wand2,
  Bot,
  RotateCcw,
  LayoutGrid,
  Search,
  Home,
  User,
  Pencil,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { useDesignSystemStore } from './lib/design-system-store';
import { useModelSettingsStore } from './lib/model-settings-store';
import { getProvider } from './lib/providers/registry';
import {
  parseDesignMd,
  resolveToken,
  tonalScale,
  readableTextColor,
  pickSurfaceColor,
  type ParsedDesignSystem,
} from './lib/parse-design-md';

type Section = 'home' | 'preview' | 'edit' | 'check' | 'history' | 'export' | 'spec';

interface StatusResponse {
  installed: boolean;
  packageVersion: string | null;
  fileExists: boolean;
  filePath: string;
  fileSize: number | null;
}

interface CliResult {
  ok: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  command: string;
  error?: string;
  format?: string;
}

interface DesignSystemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  id: Section;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PRIMARY_NAV: NavItem[] = [
  { id: 'preview', label: 'Preview', description: 'See your design system', icon: LayoutGrid },
  { id: 'edit', label: 'Edit', description: 'Update your design system', icon: FileText },
  { id: 'check', label: 'Check', description: 'Find issues automatically', icon: CheckCircle2 },
  { id: 'history', label: 'Changes', description: 'See what you changed', icon: GitCompare },
];

const SECONDARY_NAV: NavItem[] = [
  { id: 'export', label: 'Export code', icon: Download },
  { id: 'spec', label: 'How it works', icon: BookOpen },
];

export default function DesignSystemModal({ open, onOpenChange }: DesignSystemModalProps) {
  const [section, setSection] = useState<Section>('home');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [setupRunning, setSetupRunning] = useState(false);
  const [setupLog, setSetupLog] = useState('');
  const setupAbortRef = useRef<AbortController | null>(null);

  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileDirty, setFileDirty] = useState(false);

  const [lintResult, setLintResult] = useState<CliResult | null>(null);
  const [lintRunning, setLintRunning] = useState(false);

  const [diffResult, setDiffResult] = useState<CliResult | null>(null);
  const [diffRunning, setDiffRunning] = useState(false);

  const [exportFormat, setExportFormat] = useState<'tailwind' | 'dtcg'>('tailwind');
  const [exportResult, setExportResult] = useState<CliResult | null>(null);
  const [exportRunning, setExportRunning] = useState(false);

  const [specResult, setSpecResult] = useState<CliResult | null>(null);
  const [specRunning, setSpecRunning] = useState(false);

  const [aiRunning, setAiRunning] = useState(false);
  const [aiLog, setAiLog] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const aiAbortRef = useRef<AbortController | null>(null);

  const injectIntoGeneration = useDesignSystemStore((s) => s.injectIntoGeneration);
  const setInjectIntoGeneration = useDesignSystemStore((s) => s.setInjectIntoGeneration);
  const activeProvider = useModelSettingsStore((s) => s.activeProvider);
  const enabledModels = useModelSettingsStore(
    (s) => s.providerState[s.activeProvider]?.enabledModels ?? [],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const value = injectIntoGeneration ? '1' : '0';
    document.cookie = `pg-design-inject=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [injectIntoGeneration]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch('/playground/api/design/status', { cache: 'no-store' });
      const data = (await res.json()) as StatusResponse;
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadFile = useCallback(async () => {
    setFileLoading(true);
    try {
      const res = await fetch('/playground/api/design/file', { cache: 'no-store' });
      const data = (await res.json()) as { exists: boolean; content: string };
      setFileContent(data.content);
      setFileDirty(false);
    } catch {
      toast.error('Could not read your design system');
    } finally {
      setFileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      refreshStatus();
      loadFile();
    } else {
      setupAbortRef.current?.abort();
      setupAbortRef.current = null;
      aiAbortRef.current?.abort();
      aiAbortRef.current = null;
    }
  }, [open, refreshStatus, loadFile]);

  const generateFromCodebase = useCallback(async () => {
    setAiRunning(true);
    setAiLog('');
    const abort = new AbortController();
    aiAbortRef.current = abort;
    try {
      const res = await fetch('/playground/api/design/generate-from-codebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: activeProvider,
          model: enabledModels[0],
          notes: aiNotes.trim() || undefined,
        }),
        signal: abort.signal,
      });
      if (!res.body) {
        setAiLog('No response from server.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        setAiLog((prev) => prev + decoder.decode(value, { stream: true }));
      }
      toast.success('AI finished. Reloading…');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('AI generation failed');
        setAiLog((prev) => prev + `\n[error] ${(error as Error).message}`);
      }
    } finally {
      setAiRunning(false);
      aiAbortRef.current = null;
      refreshStatus();
      loadFile();
    }
  }, [activeProvider, enabledModels, aiNotes, refreshStatus, loadFile]);

  const ready = !!status?.installed && !!status?.fileExists;

  // When the user isn't set up yet, force Home (onboarding). When ready,
  // promote them to Preview the first time we know.
  useEffect(() => {
    if (!status) return;
    if (!ready) setSection('home');
    else if (section === 'home') setSection('preview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, statusLoading]);

  const runSetup = useCallback(async () => {
    setSetupRunning(true);
    setSetupLog('');
    const abort = new AbortController();
    setupAbortRef.current = abort;
    try {
      const res = await fetch('/playground/api/design/setup', {
        method: 'POST',
        signal: abort.signal,
      });
      if (!res.body) {
        setSetupLog('No response from server.');
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setSetupLog((prev) => prev + chunk);
      }
      toast.success('Design system ready');
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Setup failed');
        setSetupLog((prev) => prev + `\n[error] ${(error as Error).message}`);
      }
    } finally {
      setSetupRunning(false);
      setupAbortRef.current = null;
      refreshStatus();
      loadFile();
    }
  }, [refreshStatus, loadFile]);

  const scaffoldOnly = useCallback(async () => {
    try {
      const res = await fetch('/playground/api/design/file', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Could not create your design system');
      }
      toast.success('Created your starter design system');
      await loadFile();
      await refreshStatus();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, [loadFile, refreshStatus]);

  const saveFile = useCallback(async () => {
    setFileSaving(true);
    try {
      const res = await fetch('/playground/api/design/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: fileContent }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Save failed');
      }
      setFileDirty(false);
      toast.success('Saved');
      refreshStatus();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFileSaving(false);
    }
  }, [fileContent, refreshStatus]);

  const runLint = useCallback(async () => {
    setLintRunning(true);
    try {
      const res = await fetch('/playground/api/design/lint', { method: 'POST' });
      const data = (await res.json()) as CliResult;
      setLintResult(data);
    } finally {
      setLintRunning(false);
    }
  }, []);

  const runDiff = useCallback(async () => {
    setDiffRunning(true);
    try {
      const res = await fetch('/playground/api/design/diff', { method: 'POST' });
      const data = (await res.json()) as CliResult;
      setDiffResult(data);
    } finally {
      setDiffRunning(false);
    }
  }, []);

  const runExport = useCallback(async () => {
    setExportRunning(true);
    try {
      const res = await fetch('/playground/api/design/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: exportFormat }),
      });
      const data = (await res.json()) as CliResult;
      setExportResult(data);
    } finally {
      setExportRunning(false);
    }
  }, [exportFormat]);

  const runSpec = useCallback(async () => {
    setSpecRunning(true);
    try {
      const res = await fetch('/playground/api/design/spec');
      const data = (await res.json()) as CliResult;
      setSpecResult(data);
    } finally {
      setSpecRunning(false);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1180px] p-0 overflow-hidden">
        <div className="flex h-[80vh] max-h-[820px]">
          {/* Sidebar */}
          <aside className="w-52 flex-shrink-0 bg-stone-50/80 border-r border-stone-200/70 flex flex-col">
            <DialogHeader className="px-4 pt-4 pb-3 text-left">
              <DialogTitle className="flex items-center gap-1.5 text-[14px] font-semibold text-stone-900">
                <Palette className="w-4 h-4 text-stone-700" />
                Design System
              </DialogTitle>
              <DialogDescription className="text-[11.5px] text-stone-500 leading-snug mt-1">
                One source of truth for colors, type, and spacing.
              </DialogDescription>
            </DialogHeader>

            <div className="mx-4 h-px bg-stone-200/80" />

            {/* Primary nav — icon + title + subtitle */}
            <nav className="px-2 pt-2 flex flex-col gap-0.5">
              {PRIMARY_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = section === item.id;
                const disabled = !ready;
                return (
                  <button
                    key={item.id}
                    onClick={() => !disabled && setSection(item.id)}
                    disabled={disabled}
                    className={`group flex items-start gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-white shadow-sm text-stone-900'
                        : disabled
                        ? 'text-stone-400 cursor-not-allowed'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mt-[2px] flex-shrink-0 ${
                      isActive ? 'text-stone-800' : disabled ? 'text-stone-300' : 'text-stone-500 group-hover:text-stone-700'
                    }`} />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold leading-tight">{item.label}</div>
                      {item.description && (
                        <div className="text-[10.5px] leading-tight text-stone-500 mt-0.5 truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Secondary nav — single line items with chevron */}
            <nav className="px-2 pb-1 flex flex-col">
              {SECONDARY_NAV.map((item) => {
                const isActive = section === item.id;
                const disabled = !ready;
                return (
                  <button
                    key={item.id}
                    onClick={() => !disabled && setSection(item.id)}
                    disabled={disabled}
                    className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-white shadow-sm text-stone-900'
                        : disabled
                        ? 'text-stone-400 cursor-not-allowed'
                        : 'text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span className="text-[12.5px] font-medium">{item.label}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ${
                      disabled ? 'text-stone-300' : 'text-stone-400 group-hover:text-stone-600 group-hover:translate-x-0.5 transition-all'
                    }`} />
                  </button>
                );
              })}

              {/* AI toggle row — same single-line treatment as secondary items */}
              <button
                type="button"
                onClick={() => ready && setInjectIntoGeneration(!injectIntoGeneration)}
                disabled={!ready}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                  !ready ? 'text-stone-400 cursor-not-allowed' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span className="text-[12.5px] font-medium text-left leading-tight">Always use the DS with AI</span>
                <Switch checked={injectIntoGeneration} disabled={!ready} />
              </button>
            </nav>

            {/* Status footer */}
            <div className="mx-4 h-px bg-stone-200/80" />
            <div className="px-4 py-2.5">
              <ReadyBadge status={status} loading={statusLoading} />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            {section === 'home' && (
              <HomeSection
                status={status}
                statusLoading={statusLoading}
                setupRunning={setupRunning}
                setupLog={setupLog}
                onSetup={runSetup}
                onScaffold={scaffoldOnly}
                onGo={(s) => setSection(s)}
                injectIntoGeneration={injectIntoGeneration}
                onToggleInject={setInjectIntoGeneration}
                aiRunning={aiRunning}
                aiLog={aiLog}
                aiNotes={aiNotes}
                onAiNotes={setAiNotes}
                onAiGenerate={generateFromCodebase}
                providerLabel={getProvider(activeProvider).displayName}
              />
            )}
            {section === 'preview' && (
              <PreviewSection
                content={fileContent}
                loading={fileLoading}
                onEdit={() => setSection('edit')}
                aiRunning={aiRunning}
                onAiRegenerate={generateFromCodebase}
              />
            )}
            {section === 'edit' && (
              <EditSection
                content={fileContent}
                loading={fileLoading}
                saving={fileSaving}
                dirty={fileDirty}
                fileExists={!!status?.fileExists}
                onChange={(v) => {
                  setFileContent(v);
                  setFileDirty(true);
                }}
                onSave={saveFile}
                onScaffold={scaffoldOnly}
                onReload={loadFile}
                aiRunning={aiRunning}
                aiLog={aiLog}
                onAiRegenerate={generateFromCodebase}
              />
            )}
            {section === 'check' && (
              <ActionSection
                title="Check your design system"
                blurb="We'll scan for missing colors, broken token references, and accessibility issues like low color contrast."
                actionLabel="Run check"
                running={lintRunning}
                result={lintResult}
                onRun={runLint}
                installed={!!status?.installed}
                successHint="Looks great — no issues found."
              />
            )}
            {section === 'history' && (
              <ActionSection
                title="See what you changed"
                blurb="Compare your current design system with the last saved version in git."
                actionLabel="Show changes"
                running={diffRunning}
                result={diffResult}
                onRun={runDiff}
                installed={!!status?.installed}
                successHint="No changes since your last commit."
              />
            )}
            {section === 'export' && (
              <ExportSection
                format={exportFormat}
                setFormat={setExportFormat}
                running={exportRunning}
                result={exportResult}
                onRun={runExport}
                installed={!!status?.installed}
              />
            )}
            {section === 'spec' && (
              <SpecSection
                running={specRunning}
                result={specResult}
                installed={!!status?.installed}
                onRun={runSpec}
              />
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sidebar status badge
// ---------------------------------------------------------------------------

function ReadyBadge({ status, loading }: { status: StatusResponse | null; loading: boolean }) {
  const ready = !!status?.installed && !!status?.fileExists;
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-stone-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="font-medium">Checking…</span>
      </div>
    );
  }
  if (ready) {
    return (
      <div className="flex items-center gap-1.5 text-[12px] text-emerald-700">
        <CheckCircle2 className="w-[15px] h-[15px]" strokeWidth={2.25} />
        <span className="font-medium">Ready to use</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-amber-700">
      <AlertCircle className="w-[15px] h-[15px]" strokeWidth={2.25} />
      <span className="font-medium">Not set up yet</span>
    </div>
  );
}

function Switch({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      className={`relative inline-flex h-[18px] w-[30px] flex-shrink-0 items-center rounded-full transition-colors ${
        disabled
          ? 'bg-stone-200'
          : checked
          ? 'bg-stone-900'
          : 'bg-stone-300'
      }`}
      aria-hidden
    >
      <span
        className={`inline-block h-[14px] w-[14px] transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[14px]' : 'translate-x-[2px]'
        }`}
      />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Home — friendly onboarding / overview
// ---------------------------------------------------------------------------

function HomeSection({
  status,
  statusLoading,
  setupRunning,
  setupLog,
  onSetup,
  onScaffold,
  onGo,
  injectIntoGeneration,
  onToggleInject,
  aiRunning,
  aiLog,
  aiNotes,
  onAiNotes,
  onAiGenerate,
  providerLabel,
}: {
  status: StatusResponse | null;
  statusLoading: boolean;
  setupRunning: boolean;
  setupLog: string;
  onSetup: () => void;
  onScaffold: () => void;
  onGo: (s: Section) => void;
  injectIntoGeneration: boolean;
  onToggleInject: (v: boolean) => void;
  aiRunning: boolean;
  aiLog: string;
  aiNotes: string;
  onAiNotes: (v: string) => void;
  onAiGenerate: () => void;
  providerLabel: string;
}) {
  const ready = !!status?.installed && !!status?.fileExists;
  const installed = !!status?.installed;

  return (
    <div className="px-8 py-8 max-w-2xl">
      <h2 className="text-xl font-semibold tracking-tight text-stone-900">
        {ready ? 'Your design system is ready' : "Let's set up your design system"}
      </h2>
      <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">
        {ready
          ? 'Edit your design system, run checks, and export it for code. Turn on AI generation to keep variations on-brand automatically.'
          : 'A design system is one shared place for your colors, fonts, spacing, and rules. We\'ll create one for you in a single click.'}
      </p>

      {!ready && (
        <div className="mt-6 rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-stone-500">
              <Wand2 className="w-3.5 h-3.5" />
              Step 1 · One-click setup
            </div>
            <h3 className="mt-1.5 text-base font-semibold text-stone-900">
              Set up design system
            </h3>
            <p className="mt-1 text-[12.5px] text-stone-600 leading-relaxed">
              We&apos;ll install the tools and add helpful shortcuts to your project. Takes about 30 seconds.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={onSetup}
                disabled={setupRunning || statusLoading}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50"
              >
                {setupRunning && <Loader2 className="w-4 h-4 animate-spin" />}
                {setupRunning ? 'Setting up…' : installed ? 'Re-run setup' : 'Set up design system'}
              </button>
            </div>
          </div>

          {setupLog && (
            <div className="border-t border-stone-200 bg-stone-50 px-5 py-3">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                Setup log
              </div>
              <pre className="max-h-40 overflow-auto text-[11px] leading-relaxed font-mono text-stone-700 whitespace-pre-wrap">
                {setupLog}
              </pre>
            </div>
          )}
        </div>
      )}

      {installed && !status?.fileExists && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-amber-700">
              <Bot className="w-3.5 h-3.5" />
              Step 2 · Create your DESIGN.md
            </div>
            <h3 className="mt-1.5 text-base font-semibold text-stone-900">
              Let AI build it from your codebase
            </h3>
            <p className="mt-1 text-[12.5px] text-stone-700 leading-relaxed">
              The AI will read your Tailwind config, components, and styles to draft a{' '}
              <code className="font-mono text-[11px] bg-white/70 px-1 py-0.5 rounded">DESIGN.md</code>{' '}
              that matches what you already have. You can edit it afterward.
            </p>

            <div className="mt-3">
              <label className="text-[11px] font-medium text-stone-600 block mb-1">
                Anything specific to mention? <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={aiNotes}
                onChange={(e) => onAiNotes(e.target.value)}
                disabled={aiRunning}
                placeholder="e.g. We're a fintech with a calm, trustworthy feel. Primary brand color is teal."
                className="w-full min-h-[64px] p-2.5 text-[12px] leading-relaxed text-stone-800 bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 resize-y placeholder:text-stone-400"
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={onAiGenerate}
                disabled={aiRunning}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50"
              >
                {aiRunning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {aiRunning ? 'AI is working…' : 'Generate from my codebase'}
              </button>
              <button
                onClick={onScaffold}
                disabled={aiRunning}
                className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Use blank starter
              </button>
              <span className="ml-auto text-[10.5px] text-stone-500">
                using {providerLabel}
              </span>
            </div>
          </div>

          {aiLog && (
            <div className="border-t border-amber-200/70 bg-white/60 px-5 py-3">
              <div className="text-[10.5px] font-medium uppercase tracking-wider text-stone-500 mb-1.5">
                AI activity
              </div>
              <pre className="max-h-48 overflow-auto text-[11px] leading-relaxed font-mono text-stone-700 whitespace-pre-wrap">
                {aiLog}
              </pre>
            </div>
          )}
        </div>
      )}

      {ready && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <ShortcutCard
              icon={FileText}
              title="Edit your design system"
              description="Update colors, fonts, and spacing."
              onClick={() => onGo('edit')}
            />
            <ShortcutCard
              icon={CheckCircle2}
              title="Check for issues"
              description="Find broken references and contrast problems."
              onClick={() => onGo('check')}
            />
            <ShortcutCard
              icon={GitCompare}
              title="See what you changed"
              description="Compare to your last saved version."
              onClick={() => onGo('history')}
            />
            <ShortcutCard
              icon={Download}
              title="Export to code"
              description="Tailwind theme or W3C tokens."
              onClick={() => onGo('export')}
            />
          </div>

          <div className="mt-6 rounded-xl border border-stone-200 bg-gradient-to-br from-amber-50/40 to-stone-50 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={injectIntoGeneration}
                onChange={(e) => onToggleInject(e.target.checked)}
                className="mt-0.5 rounded border-stone-300"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-stone-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Use in AI generation
                </div>
                <p className="mt-0.5 text-[12px] text-stone-600 leading-relaxed">
                  When you generate variations on the canvas, the AI will follow your design system automatically.
                </p>
              </div>
            </label>
          </div>
        </>
      )}
    </div>
  );
}

function ShortcutCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all p-4"
    >
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 text-stone-500 group-hover:text-stone-700 transition-colors" />
        <ChevronRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 group-hover:translate-x-0.5 transition-all" />
      </div>
      <div className="mt-2.5 text-[13px] font-medium text-stone-900">{title}</div>
      <div className="mt-1 text-[11.5px] text-stone-500 leading-snug">{description}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Edit
// ---------------------------------------------------------------------------

function EditSection({
  content,
  loading,
  saving,
  dirty,
  fileExists,
  onChange,
  onSave,
  onScaffold,
  onReload,
  aiRunning,
  aiLog,
  onAiRegenerate,
}: {
  content: string;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  fileExists: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onScaffold: () => void;
  onReload: () => void;
  aiRunning: boolean;
  aiLog: string;
  onAiRegenerate: () => void;
}) {
  if (!fileExists && !loading) {
    return (
      <SectionShell title="Edit your design system" blurb="No design system file yet — create one to get started.">
        <button
          onClick={onScaffold}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors"
        >
          Create starter file
        </button>
      </SectionShell>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 pt-7 pb-3 border-b border-stone-200/60 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">
            Edit your design system
          </h2>
          <p className="mt-1 text-[12.5px] text-stone-600 leading-relaxed">
            Tokens (colors, fonts, spacing) live in the <code className="font-mono text-[11px] bg-stone-100 px-1 py-0.5 rounded">---</code> block at the top.
            Below it, write notes in plain English.
          </p>
        </div>
        <button
          onClick={onAiRegenerate}
          disabled={aiRunning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 hover:border-stone-300 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
          title="Ask AI to rewrite DESIGN.md from your current codebase"
        >
          {aiRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
          Regenerate with AI
        </button>
      </div>

      {aiLog && aiRunning && (
        <div className="px-8 py-2 border-b border-stone-200/60 bg-amber-50/60">
          <pre className="max-h-24 overflow-auto text-[10.5px] leading-relaxed font-mono text-stone-700 whitespace-pre-wrap">
            {aiLog}
          </pre>
        </div>
      )}

      <div className="flex-1 min-h-0 px-8 pt-4 pb-3">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          disabled={loading}
          className="w-full h-full min-h-[340px] p-4 text-[12.5px] leading-relaxed font-mono text-stone-800 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-300/60 resize-none shadow-sm"
        />
      </div>

      <div className="px-8 py-3 border-t border-stone-200/60 bg-stone-50/60 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11.5px]">
          {loading ? (
            <span className="text-stone-400 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading…
            </span>
          ) : dirty ? (
            <span className="text-amber-700 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          ) : (
            <span className="text-stone-500 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-emerald-600" /> All changes saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReload}
            disabled={loading || saving}
            className="px-3 py-1.5 text-[12px] font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-[12.5px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Generic action section (Check, History)
// ---------------------------------------------------------------------------

function ActionSection({
  title,
  blurb,
  actionLabel,
  running,
  result,
  onRun,
  installed,
  successHint,
}: {
  title: string;
  blurb: string;
  actionLabel: string;
  running: boolean;
  result: CliResult | null;
  onRun: () => void;
  installed: boolean;
  successHint: string;
}) {
  return (
    <SectionShell title={title} blurb={blurb}>
      <div className="flex items-center gap-2">
        <button
          onClick={onRun}
          disabled={running || !installed}
          className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50"
        >
          {running && <Loader2 className="w-4 h-4 animate-spin" />}
          {running ? 'Working…' : actionLabel}
        </button>
        {result && !running && (
          <span className="text-[11.5px] text-stone-500">
            Re-run anytime to refresh.
          </span>
        )}
      </div>

      <div className="mt-5">
        <ResultCard result={result} successHint={successHint} />
      </div>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function ExportSection({
  format,
  setFormat,
  running,
  result,
  onRun,
  installed,
}: {
  format: 'tailwind' | 'dtcg';
  setFormat: (f: 'tailwind' | 'dtcg') => void;
  running: boolean;
  result: CliResult | null;
  onRun: () => void;
  installed: boolean;
}) {
  return (
    <SectionShell
      title="Export to code"
      blurb="Turn your design system into a format your code can use. Tailwind plugs straight into a Tailwind project; W3C tokens work with most other tools."
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <FormatCard
            label="Tailwind"
            description="Drop into tailwind.config"
            active={format === 'tailwind'}
            onClick={() => setFormat('tailwind')}
          />
          <FormatCard
            label="W3C tokens"
            description="DTCG JSON for Figma & others"
            active={format === 'dtcg'}
            onClick={() => setFormat('dtcg')}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRun}
            disabled={running || !installed}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50"
          >
            {running && <Loader2 className="w-4 h-4 animate-spin" />}
            {running ? 'Generating…' : 'Generate'}
          </button>
          {result?.ok && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.stdout);
                  toast.success('Copied to clipboard');
                } catch {
                  toast.error('Copy failed');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          )}
        </div>

        <ResultCard result={result} successHint="Click Generate to see the output." />
      </div>
    </SectionShell>
  );
}

function FormatCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border p-3.5 transition-all ${
        active
          ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
          : 'border-stone-200 bg-white hover:border-stone-300 text-stone-700'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold">{label}</span>
        {active && <Check className="w-3.5 h-3.5" />}
      </div>
      <div className={`mt-1 text-[11px] ${active ? 'text-stone-300' : 'text-stone-500'}`}>
        {description}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Spec — auto-loads
// ---------------------------------------------------------------------------

function SpecSection({
  running,
  result,
  installed,
  onRun,
}: {
  running: boolean;
  result: CliResult | null;
  installed: boolean;
  onRun: () => void;
}) {
  useEffect(() => {
    if (installed && !result && !running) {
      onRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed]);

  return (
    <SectionShell
      title="How design.md works"
      blurb="The format spec — what each section means and which fields are required. Helpful when teaching the AI about a custom design pattern."
    >
      <ResultCard result={result} successHint="Loading the spec…" />
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// Shared shell
// ---------------------------------------------------------------------------

function SectionShell({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-8 py-7 max-w-3xl">
      <h2 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
      <p className="mt-1.5 text-[12.5px] text-stone-600 leading-relaxed max-w-xl">{blurb}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result card — friendly result rendering
// ---------------------------------------------------------------------------

function ResultCard({ result, successHint }: { result: CliResult | null; successHint?: string }) {
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-5 text-center">
        <p className="text-[12px] text-stone-500">{successHint ?? 'Run an action to see results here.'}</p>
      </div>
    );
  }
  if (result.error) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-amber-900">Heads up</div>
            <p className="mt-0.5 text-[12px] text-amber-800 leading-relaxed">{result.error}</p>
          </div>
        </div>
      </div>
    );
  }
  const output = result.stdout || result.stderr || '';
  const isClean = result.ok && output.trim().length === 0;
  if (isClean) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[12.5px] font-medium text-emerald-900">All good</div>
            <p className="mt-0.5 text-[12px] text-emerald-800 leading-relaxed">
              {successHint ?? 'No issues found.'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm overflow-hidden ${
        result.ok ? 'border-stone-200' : 'border-rose-200'
      }`}
    >
      <div
        className={`px-4 py-2 text-[10.5px] font-medium uppercase tracking-wider flex items-center justify-between ${
          result.ok ? 'bg-stone-50 text-stone-500' : 'bg-rose-50 text-rose-700'
        }`}
      >
        <span>{result.ok ? 'Output' : 'Issues found'}</span>
        {result.exitCode !== null && result.exitCode !== 0 && (
          <span className="font-mono normal-case text-[10px]">
            exit {result.exitCode}
          </span>
        )}
      </div>
      <pre className="max-h-[340px] overflow-auto p-4 text-[11.5px] leading-relaxed font-mono text-stone-800 whitespace-pre-wrap">
        {output}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview — bento-grid showcase of the parsed design system
// ---------------------------------------------------------------------------

function PreviewSection({
  content,
  loading,
  onEdit,
  aiRunning,
  onAiRegenerate,
}: {
  content: string;
  loading: boolean;
  onEdit: () => void;
  aiRunning: boolean;
  onAiRegenerate: () => void;
}) {
  const ds = parseDesignMd(content);
  const colorEntries = Object.entries(ds.colors).filter(([k]) =>
    !k.startsWith('on-'),
  );
  const surface = pickSurfaceColor(ds);
  const headlineFont = ds.typography.h1?.fontFamily || ds.typography.headline?.fontFamily || 'serif';
  const bodyFont = ds.typography['body-md']?.fontFamily || ds.typography.body?.fontFamily || 'sans-serif';
  const labelFont = ds.typography['label-caps']?.fontFamily || ds.typography.label?.fontFamily || bodyFont;

  const primaryHex = ds.colors.primary || '#141414';
  const secondaryHex = ds.colors.secondary || ds.colors.tertiary || '#EC722F';
  const tertiaryHex = ds.colors.tertiary || ds.colors.secondary || primaryHex;
  const onPrimary = ds.colors['on-primary'] || readableTextColor(primaryHex);
  const onSecondary = ds.colors['on-secondary'] || readableTextColor(secondaryHex);
  const onTertiary = ds.colors['on-tertiary'] || readableTextColor(tertiaryHex);
  const danger = ds.colors.destructive || ds.colors.danger || '#C0362C';

  if (loading) {
    return (
      <div className="px-8 py-10 text-stone-400 text-sm flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your design system…
      </div>
    );
  }

  if (colorEntries.length === 0 && Object.keys(ds.typography).length === 0) {
    return (
      <SectionShell
        title="Preview"
        blurb="Your DESIGN.md doesn't define any tokens yet. Use the AI to draft one from your codebase, or open the editor to add some."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onAiRegenerate}
            disabled={aiRunning}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-white bg-stone-900 hover:bg-black rounded-lg transition-colors disabled:opacity-50"
          >
            {aiRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate from my codebase
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 text-[13px] font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Open editor
          </button>
        </div>
      </SectionShell>
    );
  }

  return (
    <div className="px-7 py-7">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-stone-900">
            {ds.name || 'Your design system'}
          </h2>
          {ds.description && (
            <p className="mt-1 text-[12.5px] text-stone-600 leading-relaxed max-w-xl">
              {ds.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onAiRegenerate}
            disabled={aiRunning}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors disabled:opacity-50"
            title="Regenerate from your codebase"
          >
            {aiRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Regenerate
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-stone-700 bg-white border border-stone-200 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-stone-500">
          Tokens
        </span>
        <span className="text-[11px] text-stone-400">
          Live from your DESIGN.md front-matter — updates instantly on edit.
        </span>
      </div>
      <div className="grid grid-cols-12 gap-4">
        {/* Column 1: Colors stack */}
        <div className="col-span-3 flex flex-col gap-4">
          {colorEntries.slice(0, 5).map(([name, hex]) => (
            <ColorCard key={name} name={name} hex={hex} />
          ))}
        </div>

        {/* Column 2: Typography */}
        <div className="col-span-4 flex flex-col gap-4">
          <TypographyCard label="Headline" font={headlineFont} surface={surface} serif />
          <TypographyCard label="Body" font={bodyFont} surface={surface} />
          <TypographyCard label="Label" font={labelFont} surface={surface} />
        </div>

        {/* Column 3: Components — merged into a single column */}
        <div className="col-span-5 flex flex-col gap-4">
          <ShowcaseCard surface={surface}>
            <div className="grid grid-cols-2 gap-2.5">
              <PreviewButton label="Primary" bg={primaryHex} text={onPrimary} rounded={ds.rounded.md} />
              <PreviewButton label="Secondary" bg={surface} text={primaryHex} rounded={ds.rounded.md} muted />
              <PreviewButton label="Inverted" bg={primaryHex} text={onPrimary} rounded={ds.rounded.md} />
              <PreviewButton label="Outlined" bg="transparent" text={primaryHex} rounded={ds.rounded.md} outlined borderColor={primaryHex} />
            </div>
          </ShowcaseCard>

          <div className="grid grid-cols-2 gap-4">
            <ShowcaseCard surface={surface}>
              <div
                className="flex items-center gap-2 bg-white px-3"
                style={{
                  borderRadius: ds.rounded.lg || ds.rounded.md || '999px',
                  height: 40,
                }}
              >
                <Search className="w-4 h-4 text-stone-400" />
                <span
                  className="text-stone-400"
                  style={{ fontFamily: bodyFont, fontSize: 13 }}
                >
                  Search
                </span>
              </div>
            </ShowcaseCard>

            <ShowcaseCard surface={surface}>
              <div className="flex flex-col gap-2 py-3">
                <div className="h-[3px] rounded-full" style={{ background: primaryHex, width: '85%' }} />
                <div className="h-[3px] rounded-full" style={{ background: secondaryHex, width: '70%' }} />
                <div className="h-[3px] rounded-full" style={{ background: primaryHex, width: '55%' }} />
              </div>
            </ShowcaseCard>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ShowcaseCard surface={surface}>
              <div className="flex items-center justify-around py-1.5">
                <div
                  className="flex items-center justify-center"
                  style={{
                    background: primaryHex,
                    color: onPrimary,
                    borderRadius: 999,
                    width: 36,
                    height: 36,
                  }}
                >
                  <Home className="w-4 h-4" />
                </div>
                <Search className="w-[18px] h-[18px] text-stone-500" />
                <User className="w-[18px] h-[18px] text-stone-500" />
              </div>
            </ShowcaseCard>

            <ShowcaseCard surface={surface}>
              <div className="flex items-center justify-around py-1">
                <CircleIcon bg={primaryHex} text={onPrimary} icon={Wand2} />
                <CircleIcon bg={secondaryHex} text={onSecondary} icon={LayoutGrid} />
                <CircleIcon bg={tertiaryHex} text={onTertiary} icon={Tag} />
                <CircleIcon bg={danger} text="#fff" icon={Trash2} />
              </div>
            </ShowcaseCard>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-4">
            <ShowcaseCard surface={surface} compact>
              <div
                className="flex items-center justify-center mx-auto"
                style={{
                  background: primaryHex,
                  color: onPrimary,
                  borderRadius: ds.rounded.md || '8px',
                  width: 44,
                  height: 44,
                }}
              >
                <Pencil className="w-4 h-4" />
              </div>
            </ShowcaseCard>
            <ShowcaseCard surface={surface} compact>
              <div
                className="inline-flex items-center gap-1.5 px-3.5 py-2"
                style={{
                  background: 'transparent',
                  color: primaryHex,
                  borderRadius: ds.rounded.md || '8px',
                  border: `1px solid ${primaryHex}`,
                  fontFamily: bodyFont,
                  fontSize: 13,
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Label
              </div>
            </ShowcaseCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorCard({ name, hex }: { name: string; hex: string }) {
  const text = readableTextColor(hex);
  const scale = tonalScale(hex);
  return (
    <div
      className="rounded-2xl overflow-hidden border border-stone-200/60 shadow-sm"
      style={{ background: hex }}
    >
      <div className="flex items-start justify-between px-4 pt-3.5 pb-3" style={{ color: text }}>
        <span className="text-[13px] font-semibold capitalize">{name.replace(/-/g, ' ')}</span>
        <span className="text-[11.5px] font-mono tracking-tight opacity-90">
          {hex.toUpperCase()}
        </span>
      </div>
      <div className="h-12" style={{ background: hex }} />
      <div className="flex h-7">
        {scale.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
    </div>
  );
}

function TypographyCard({
  label,
  font,
  surface,
  serif,
}: {
  label: string;
  font: string;
  surface: string;
  serif?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-stone-200/40 px-4 pt-3.5 pb-2 flex flex-col"
      style={{ background: surface, minHeight: 170 }}
    >
      <div className="flex items-center justify-between text-stone-500">
        <span className="text-[12px]">{label}</span>
        <span className="text-[12px]">{font.split(',')[0].replace(/['"]/g, '').trim()}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span
          className="text-stone-900 leading-none"
          style={{
            fontFamily: serif ? `"${font.split(',')[0].replace(/['"]/g, '')}", serif` : `"${font.split(',')[0].replace(/['"]/g, '')}", sans-serif`,
            fontSize: 96,
            fontWeight: serif ? 500 : 400,
          }}
        >
          Aa
        </span>
      </div>
    </div>
  );
}

function ShowcaseCard({
  children,
  surface,
  compact,
}: {
  children: React.ReactNode;
  surface: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-stone-200/40 flex items-center justify-center ${
        compact ? 'px-3 py-3' : 'px-4 py-4'
      }`}
      style={{ background: surface, minHeight: compact ? 78 : 96 }}
    >
      <div className="w-full">{children}</div>
    </div>
  );
}

function PreviewButton({
  label,
  bg,
  text,
  rounded,
  muted,
  outlined,
  borderColor,
}: {
  label: string;
  bg: string;
  text: string;
  rounded?: string;
  muted?: boolean;
  outlined?: boolean;
  borderColor?: string;
}) {
  return (
    <div
      className="flex items-center justify-center text-[12.5px] font-medium"
      style={{
        background: bg,
        color: text,
        borderRadius: rounded || '8px',
        height: 36,
        border: outlined && borderColor ? `1px solid ${borderColor}` : muted ? '1px solid rgba(0,0,0,0.06)' : 'none',
      }}
    >
      {label}
    </div>
  );
}

function CircleIcon({
  bg,
  text,
  icon: Icon,
}: {
  bg: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ background: bg, color: text, width: 36, height: 36, borderRadius: 999 }}
    >
      <Icon className="w-4 h-4" />
    </div>
  );
}

// Suppress "unused" warnings for resolveToken / ParsedDesignSystem when only
// indirectly used; both are public API of the parser.
void resolveToken;
export type { ParsedDesignSystem as _ParsedDesignSystem };

