// filepath: bridge_client/src/components/WebTerminal.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSSE, ChatMessage, ExecutionStep, TimelineItem } from '@/hooks/useSSE';
import { Button } from './animate-ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import { MermaidRenderer } from './MermaidRenderer';
import { WorkspaceData } from '../App';

interface FileContentViewerProps {
  content: string;
  filePath: string;
  totalLines?: number | null;
}

const FileContentViewer = React.memo(function FileContentViewer({ content, filePath, totalLines }: FileContentViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs my-1">
      {/* Header Bar */}
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-1.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-1.5 overflow-hidden mr-2">
          <span className="text-xs shrink-0">📄</span>
          <span className="text-[10px] font-bold text-zinc-700 font-mono truncate" title={filePath}>
            {filePath || 'untitled-file'}
          </span>
          {totalLines && (
            <span className="text-[8px] bg-blue-50 text-blue-600 border border-blue-100 px-1 py-0.2 rounded font-mono font-bold shrink-0">
              {totalLines} dòng
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="px-1.5 py-0.5 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-655 hover:text-zinc-800 rounded text-[9px] font-semibold cursor-pointer transition-colors shadow-xs shrink-0"
        >
          {copied ? 'Đã sao chép ✓' : 'Sao chép'}
        </button>
      </div>

      {/* Code Text Area */}
      <div className="p-3 bg-zinc-50/10 overflow-x-auto overflow-y-auto max-h-80 border-t border-zinc-100/30">
        <pre className="text-[11px] text-zinc-755 whitespace-pre font-mono leading-relaxed text-left">
          {content}
        </pre>
      </div>
    </div>
  );
});
FileContentViewer.displayName = "FileContentViewer";

// =================================================================
// 🎨 Component: Git Sandbox Diff Viewer
// =================================================================
interface DiffViewerProps {
  filePath: string;
}

const DiffViewer = React.memo(function DiffViewer({ filePath }: DiffViewerProps) {
  const [diffText, setDiffText] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiff = useCallback(() => {
    setLoading(true);
    fetch('/api/dashboard/code-changes')
      .then((res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.changes)) {
          const cleanPath = (p: string) => p.replace(/\\/g, '/').toLowerCase();
          const pathBasename = (p: string) => p.split('/').pop() || '';

          const matched = data.changes.find((c: any) => {
            const cFile = cleanPath(c.file);
            const fFile = cleanPath(filePath);
            return cFile.endsWith(fFile) || fFile.endsWith(cFile) || pathBasename(cFile) === pathBasename(fFile);
          });

          if (matched && matched.diff) {
            setDiffText(matched.diff);
          } else {
            setDiffText(null);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [filePath]);

  useEffect(() => {
    fetchDiff();
  }, [fetchDiff]);

  if (loading) {
    return (
      <div className="text-zinc-400 text-[10px] italic py-1 select-none">
        ⌛ Đang so sánh thay đổi với Git Worktree...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-[10px] py-1 select-none">
        ❌ Không thể tải Git Diff: {error}
      </div>
    );
  }

  if (!diffText) {
    return (
      <div className="text-zinc-500 text-[10px] italic bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 select-none">
        ℹ️ Không có thay đổi so với phiên bản gốc (Git Worktree sạch).
      </div>
    );
  }

  const lines = diffText.split('\n');

  return (
    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs my-1 select-text">
      <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-1.5 flex items-center justify-between select-none">
        <span className="text-[10px] font-bold text-zinc-700 flex items-center gap-1.5">
          <span>📊</span> Git Sandbox Diff
        </span>
        <button
          type="button"
          onClick={fetchDiff}
          className="text-[9px] text-blue-600 hover:text-blue-500 font-semibold cursor-pointer"
        >
          Nạp lại 🔄
        </button>
      </div>
      <div className="p-2.5 bg-zinc-900 text-zinc-100 overflow-x-auto max-h-80 font-mono text-[11px] leading-relaxed border-t border-zinc-800">
        {lines.map((line, idx) => {
          let colorClass = "text-zinc-300";
          let bgClass = "";

          if (line.startsWith('+') && !line.startsWith('+++')) {
            colorClass = "text-emerald-400";
            bgClass = "bg-emerald-950/40 border-l-2 border-emerald-500 pl-1";
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            colorClass = "text-rose-400";
            bgClass = "bg-rose-950/40 border-l-2 border-rose-500 pl-1";
          } else if (line.startsWith('@@')) {
            colorClass = "text-cyan-400";
            bgClass = "bg-cyan-950/30 border-l-2 border-cyan-500 pl-1";
          } else if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
            colorClass = "text-zinc-500 font-bold italic";
          }

          return (
            <div key={idx} className={`whitespace-pre py-0.5 ${bgClass} ${colorClass}`}>
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
});
DiffViewer.displayName = "DiffViewer";

// =================================================================
// 🎨 Component: Giao diện Wizard câu hỏi hiện đại của FluxMem
// =================================================================
interface QuestionOption {
  label: string;
  value: string;
  is_default?: boolean;
}

interface QuestionItem {
  id: string;
  question: string;
  type: "select" | "multi_select" | "text";
  options?: QuestionOption[];
  allow_custom?: boolean;
}

interface StructuredQuestionsFormProps {
  data: {
    explanation: string;
    questions: any;
  };
  onSubmit: (answers: Record<string, any>) => void;
  onCancel: () => void;
}

const StructuredQuestionsForm = React.memo(function StructuredQuestionsForm({ data, onSubmit, onCancel }: StructuredQuestionsFormProps) {
  const questionsArray = useMemo<QuestionItem[]>(() => {
    let q = data.questions;
    if (typeof q === 'string') {
      try {
        q = JSON.parse(q);
      } catch (e) {
        q = [];
      }
    }
    return Array.isArray(q) ? (q as QuestionItem[]) : [];
  }, [data.questions]);

  const [formState, setFormState] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    questionsArray.forEach((q: QuestionItem) => {
      if (q.type === 'select') {
        const defaultOpt = q.options?.find((o: QuestionOption) => o.is_default);
        initial[q.id] = defaultOpt ? defaultOpt.value : (q.options?.[0]?.value || '');
      } else if (q.type === 'multi_select') {
        initial[q.id] = q.options?.filter((o: QuestionOption) => o.is_default).map((o: QuestionOption) => o.value) || [];
      } else {
        initial[q.id] = '';
      }
    });
    return initial;
  });

  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [useCustom, setUseCustom] = useState<Record<string, boolean>>({});

  const handleToggleMultiSelect = useCallback((qId: string, val: string) => {
    setFormState(prev => {
      const current = prev[qId] || [];
      const next = current.includes(val)
        ? current.filter((v: string) => v !== val)
        : [...current, val];
      return { ...prev, [qId]: next };
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalAnswers: Record<string, any> = {};
    questionsArray.forEach((q: QuestionItem) => {
      if (q.type === 'select') {
        finalAnswers[q.id] = useCustom[q.id] ? (customValues[q.id] || '') : formState[q.id];
      } else if (q.type === 'multi_select') {
        const selected = [...(formState[q.id] || [])];
        if (q.allow_custom && useCustom[q.id] && customValues[q.id]) {
          selected.push(customValues[q.id]);
        }
        finalAnswers[q.id] = selected;
      } else {
        finalAnswers[q.id] = formState[q.id];
      }
    });
    onSubmit(finalAnswers);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 shadow-inner">
        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-0.5">💡 GIẢI THÍCH NGỮ CẢNH CỦA AGENT</span>
        <p className="text-[11px] text-zinc-700 leading-relaxed font-semibold">{data.explanation}</p>
      </div>

      <div className="space-y-4 divide-y divide-zinc-100 max-h-[300px] overflow-y-auto pr-1">
        {questionsArray.map((q: QuestionItem, idx: number) => (
          <div key={q.id} className={`pt-3.5 ${idx === 0 ? 'pt-0 border-none' : ''}`}>
            <label className="text-[11px] font-bold text-zinc-800 block mb-2">
              <span className="text-blue-600 font-extrabold mr-1.5">{idx + 1}.</span>
              {q.question}
            </label>

            {q.type === 'select' && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {q.options?.map((opt: QuestionOption) => {
                    const isSelected = formState[q.id] === opt.value && !useCustom[q.id];
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setUseCustom(prev => ({ ...prev, [q.id]: false }));
                          setFormState(prev => ({ ...prev, [q.id]: opt.value }));
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50'
                          }`}
                      >
                        {opt.label} {opt.is_default && <span className={isSelected ? 'text-blue-200' : 'text-blue-500'}>★</span>}
                      </button>
                    );
                  })}
                  {q.allow_custom && (
                    <button
                      type="button"
                      onClick={() => useCustom[q.id] = true}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${useCustom[q.id]
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-zinc-200 text-zinc-655 hover:bg-zinc-50'
                        }`}
                    >
                      ✏️ Tự nhập...
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {useCustom[q.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <input
                        type="text"
                        required
                        value={customValues[q.id] || ''}
                        onChange={(e) => setCustomValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Nhập phương án tự định nghĩa của bạn..."
                        className="w-full mt-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {q.type === 'multi_select' && (
              <div className="space-y-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {q.options?.map((opt: QuestionOption) => {
                    const isSelected = formState[q.id]?.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleToggleMultiSelect(q.id, opt.value)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50'
                          }`}
                      >
                        {isSelected ? '✓ ' : ''}{opt.label} {opt.is_default && <span className={isSelected ? 'text-blue-200' : 'text-blue-500'}>★</span>}
                      </button>
                    );
                  })}
                  {q.allow_custom && (
                    <button
                      type="button"
                      onClick={() => useCustom[q.id] = !useCustom[q.id]}
                      className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${useCustom[q.id]
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-zinc-200 text-zinc-655 hover:bg-zinc-50'
                        }`}
                    >
                      ✏️ Ý kiến bổ sung...
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {useCustom[q.id] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <input
                        type="text"
                        required
                        value={customValues[q.id] || ''}
                        onChange={(e) => setCustomValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Nhập phương án bổ sung..."
                        className="w-full mt-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {q.type === 'text' && (
              <textarea
                required
                value={formState[q.id] || ''}
                onChange={(e) => setFormState(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Nhập câu trả lời chi tiết của bạn..."
                rows={2}
                className="w-full px-2.5 py-2 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs resize-none"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-1.5 justify-end border-t border-zinc-150 pt-3 mt-1">
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="text-zinc-655 border-zinc-200 hover:bg-zinc-50 text-[10px] h-7 px-2.5 cursor-pointer"
          onClick={onCancel}
        >
          Từ chối (Hủy bỏ)
        </Button>
        <Button
          variant="default"
          size="sm"
          type="submit"
          className="text-[10px] h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer border-none font-semibold"
        >
          ✓ Xác nhận hoàn tất
        </Button>
      </div>
    </form>
  );
});
StructuredQuestionsForm.displayName = "StructuredQuestionsForm";

interface ProviderInfo {
  key: string;
  name: string;
}

interface CommandInfo {
  cmd: string;
  alias: string | null;
  desc: string;
  category: string;
}

function parseContentAndMermaid(content: string) {
  const regex = /```mermaid\n([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const textBefore = content.substring(lastIndex, match.index);
    if (textBefore.trim()) {
      parts.push({ type: 'markdown', content: textBefore });
    }
    parts.push({ type: 'mermaid', content: match[1] });
    lastIndex = regex.lastIndex;
  }

  const textAfter = content.substring(lastIndex);
  if (textAfter.trim() || parts.length === 0) {
    parts.push({ type: 'markdown', content: textAfter });
  }

  return parts;
}

const getMessageTimeline = (msg: ChatMessage, msgIdx: number): TimelineItem[] => {
  if (msg.timeline && msg.timeline.length > 0) {
    return msg.timeline;
  }

  const reconstructed: TimelineItem[] = [];
  if (msg.steps && msg.steps.length > 0) {
    reconstructed.push({
      id: `reconstructed-steps-${msgIdx}-${msg.steps.length}`,
      type: 'steps',
      steps: msg.steps
    });
  }
  if (msg.content && msg.content.trim()) {
    reconstructed.push({
      id: `reconstructed-text-${msgIdx}`,
      type: 'text',
      content: msg.content
    });
  }
  return reconstructed;
};

const TimelineTextBlock = React.memo(({ content }: { content: string }) => {
  const cleanContent = useMemo(() => {
    return content
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
      .trim();
  }, [content]);

  const parts = useMemo(() => {
    return parseContentAndMermaid(cleanContent);
  }, [cleanContent]);

  return (
    <div className="space-y-3.5 text-left">
      {parts.map((part, partIdx) => {
        if (part.type === 'mermaid') {
          return (
            <div key={partIdx} className="my-1.5">
              <MermaidRenderer code={part.content} />
            </div>
          );
        }
        const htmlContent = marked.parse(part.content) as string;
        return (
          <div
            key={partIdx}
            className="markdown-body-light text-left leading-relaxed text-[13px] select-text"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        );
      })}
    </div>
  );
});
TimelineTextBlock.displayName = "TimelineTextBlock";

interface CollapsibleStepsProps {
  steps: ExecutionStep[];
  forceExpand?: boolean;
}

const CollapsibleSteps = React.memo(function CollapsibleSteps({ steps, forceExpand = false }: CollapsibleStepsProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (forceExpand) {
      setIsCollapsed(false);
    } else {
      setIsCollapsed(true);
    }
  }, [forceExpand]);

  if (!steps || steps.length === 0) return null;

  const thinkingCount = steps.filter(s => s.type === 'thinking').length;
  const fileCount = steps.filter(s => s.type === 'read_file').length;
  const commandCount = steps.filter(s => s.type === 'terminal' || s.type === 'search').length;

  const toggleStep = (stepId: string) => {
    setCollapsedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div className="my-2.5 text-left select-none max-w-full">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500 hover:text-zinc-700 transition-colors cursor-pointer py-1 px-2.5 bg-zinc-50 border border-zinc-200 rounded-lg shadow-xs"
      >
        <span
          className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-[7px] text-white transition-transform duration-200 select-none shrink-0 font-bold"
          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}
        >
          ▼
        </span>
        <span className="text-zinc-650">
          Thought {thinkingCount}x, Read {fileCount}x, Run {commandCount}x
        </span>
      </button>

      {!isCollapsed && (
        <div className="mt-2 pl-3 border-l border-zinc-200 space-y-3 max-w-full">
          {steps.map((step) => {
            const isStepExpanded = !collapsedSteps[step.id];
            const icon = step.type === 'thinking' ? '🧠' : step.type === 'read_file' ? '📄' : step.type === 'search' ? '🔍' : '💻';

            return (
              <div key={step.id} className="border border-zinc-200 rounded-lg bg-white overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className="flex items-center justify-between w-full p-2 bg-zinc-50/50 hover:bg-zinc-100/60 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden mr-2">
                    <span className="text-xs shrink-0">{icon}</span>
                    <span className="text-[11px] font-bold text-zinc-700 font-mono truncate">
                      {step.title}
                    </span>
                  </div>
                  <span className="text-[9px] text-zinc-400 font-semibold shrink-0">
                    {isStepExpanded ? 'Thu gọn [-]' : 'Mở rộng [+]'}
                  </span>
                </button>

                {isStepExpanded && (
                  <div className="border-t border-zinc-200 p-3 bg-zinc-50/10 text-[11px] text-zinc-800 space-y-3 select-text font-mono">
                    {step.type === 'thinking' && (
                      <div className="space-y-1">
                        <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Thinking process</div>
                        <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-650 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                          {step.input}
                        </pre>
                      </div>
                    )}

                    {step.type === 'terminal' && (() => {
                      let outputText = step.output || '';
                      try {
                        const parsed = typeof step.output === 'string' ? JSON.parse(step.output) : step.output;
                        if (parsed && typeof parsed === 'object') {
                          if (parsed.status === 'success' && parsed.data) {
                            if (parsed.data.stdout !== undefined || parsed.data.stderr !== undefined) {
                              outputText = (parsed.data.stdout || '') + (parsed.data.stderr || '');
                            } else if (typeof parsed.data === 'string') {
                              outputText = parsed.data;
                            } else {
                              outputText = JSON.stringify(parsed.data, null, 2);
                            }
                          } else if (parsed.status === 'error') {
                            outputText = parsed.error_message || parsed.rawText || JSON.stringify(parsed, null, 2);
                          }
                        }
                      } catch (e) {
                        // ignore
                      }

                      return (
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Terminal Console</div>
                          <div
                            style={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7' }}
                            className="p-3 border rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap shadow-xs"
                          >
                            <div className="flex items-start gap-1.5 mb-2 pb-1.5 border-b border-zinc-100">
                              <span className="text-emerald-600 font-bold select-none shrink-0" style={{ color: '#059669' }}>$</span>
                              <span className="font-semibold break-all" style={{ color: '#2563eb' }}>
                                {step.input}
                              </span>
                            </div>

                            {outputText ? (
                              <div className="text-zinc-800 max-h-60 overflow-y-auto whitespace-pre-wrap leading-normal" style={{ color: '#27272a' }}>
                                {outputText}
                              </div>
                            ) : (
                              <div className="text-zinc-400 italic select-none" style={{ color: '#a1a1aa' }}>
                                Command executed / awaiting response...
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                    }

                    {step.type === 'read_file' && (() => {
                      let isDir = false;
                      let dirPath = '';
                      let filesList: Array<{ name: string, type: string, path: string }> = [];
                      let fileContent = '';
                      let fileMeta: { file?: string; totalLines?: number } | null = null;
                      let rawText = step.output || '';

                      try {
                        const parsed = typeof step.output === 'string' ? JSON.parse(step.output) : step.output;
                        if (parsed && typeof parsed === 'object') {
                          const targetData = parsed.status === 'success' && parsed.data ? parsed.data : parsed;
                          if (targetData && typeof targetData === 'object') {
                            if (Array.isArray(targetData.files)) {
                              isDir = true;
                              dirPath = targetData.path || '';
                              filesList = targetData.files;
                            } else if (targetData.content !== undefined) {
                              fileContent = targetData.content;
                              fileMeta = {
                                file: targetData.file || targetData.file_path || '',
                                totalLines: targetData.total_lines || null,
                              };
                            } else if (typeof targetData === 'string') {
                              fileContent = targetData;
                            } else {
                              rawText = JSON.stringify(parsed, null, 2);
                            }
                          }
                        }
                      } catch (e) {
                        // ignore
                      }

                      let displayContent = fileContent;
                      if (!isDir && !displayContent && rawText) {
                        const trimmed = rawText.trim();
                        const isJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
                        if (!isJson) {
                          displayContent = rawText;
                        }
                      }

                      return (
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                            {isDir ? 'Danh sách thư mục' : 'Nội dung tập tin'}
                          </div>

                          {isDir ? (
                            <div className="p-3 bg-white border border-zinc-200 rounded-lg max-h-72 overflow-y-auto space-y-1.5 shadow-xs text-left">
                              {dirPath && (
                                <div className="text-[10px] text-zinc-450 font-mono border-b border-zinc-100 pb-1 mb-1.5 truncate">
                                  📂 {dirPath}
                                </div>
                              )}
                              <div className="divide-y divide-zinc-100 text-[11px] font-mono">
                                {filesList.map((file, fIdx) => (
                                  <div key={fIdx} className="flex items-center gap-1.5 py-1 hover:bg-zinc-50/70 px-1 rounded transition-colors">
                                    <span className="text-xs shrink-0 select-none">
                                      {file.type === 'directory' ? '📁' : '📄'}
                                    </span>
                                    <span className={file.type === 'directory' ? 'text-blue-600 font-semibold' : 'text-zinc-700'}>
                                      {file.name}
                                    </span>
                                    <span className="text-[8px] text-zinc-400 truncate ml-auto hidden md:inline">
                                      {file.path}
                                    </span>
                                  </div>
                                ))}
                                {filesList.length === 0 && (
                                  <div className="text-zinc-400 italic text-center py-3 select-none">Thư mục trống</div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <FileContentViewer
                              content={displayContent || rawText}
                              filePath={fileMeta?.file || step.title.replace('📄 Read File: ', '').replace('📄 Read File ', '')}
                              totalLines={fileMeta?.totalLines}
                            />
                          )}
                        </div>
                      );
                    })()}

                    {step.type === 'search' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Search Input</div>
                          <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-650 whitespace-pre-wrap">
                            {step.input}
                          </pre>
                        </div>
                        {step.output && (
                          <div className="space-y-1">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Search Result</div>
                            <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                              {step.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {step.type === 'generic' && (
                      <div className="space-y-2.5">
                        {step.input && (
                          <div className="space-y-1">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">File Path / Input</div>
                            <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-650 whitespace-pre-wrap">
                              {step.input}
                            </pre>
                          </div>
                        )}

                        {/* HIỂN THỊ DIFF TỰ ĐỘNG CHO WRITE VÀ REPLACE */}
                        {(step.toolName === 'write_file' || step.toolName === 'replace_by_lines_safe' || step.title.toLowerCase().includes('write_file') || step.title.toLowerCase().includes('replace_by_lines_safe')) && step.input && (
                          <div className="space-y-1">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Git Sandbox Diff</div>
                            <DiffViewer filePath={step.input} />
                          </div>
                        )}

                        {step.output && (
                          <div className="space-y-1">
                            <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Result</div>
                            <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 whitespace-pre-wrap leading-relaxed">
                              {step.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
CollapsibleSteps.displayName = "CollapsibleSteps";

interface ChatInputFormProps {
  activeAgent: "MaxHermes" | "MaxClaw";
  currentActiveModelName: string;
  realProviders: ProviderInfo[];
  handleSwitchProvider: (providerKey: string, providerName: string) => void;
  isGenerating: boolean;
  stopGeneration: () => void;
  availableCommands: CommandInfo[];
  onSendMessage: (
    prompt: string,
    useReformulate: boolean,
    useHeadless: boolean,
    pastedImage: string | null
  ) => void;
}

const ChatInputForm = React.memo(function ChatInputForm({
  activeAgent,
  currentActiveModelName,
  realProviders,
  handleSwitchProvider,
  isGenerating,
  stopGeneration,
  availableCommands,
  onSendMessage
}: ChatInputFormProps) {
  const [input, setInput] = useState('');

  // SỬA: Khởi tạo giá trị ban đầu an toàn từ localStorage thay vì mặc định cứng
  const [useReformulate, setUseReformulate] = useState(() => {
    try {
      const saved = localStorage.getItem('bridge_use_reformulate');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [useHeadless, setUseHeadless] = useState(() => {
    try {
      const saved = localStorage.getItem('bridge_use_headless');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showCommandSuggest, setShowCommandSuggest] = useState(false);
  const [filteredSuggests, setFilteredSuggests] = useState<CommandInfo[]>([]);

  // SỬA: Đồng bộ hóa cập nhật vào localStorage bất cứ khi nào giá trị thay đổi
  useEffect(() => {
    localStorage.setItem('bridge_use_reformulate', JSON.stringify(useReformulate));
  }, [useReformulate]);

  useEffect(() => {
    localStorage.setItem('bridge_use_headless', JSON.stringify(useHeadless));
  }, [useHeadless]);

  const handleInputChange = (val: string) => {
    setInput(val);
    if (val.startsWith('/')) {
      const query = val.toLowerCase();
      const filtered = availableCommands.filter(c =>
        c.cmd.startsWith(query) || (c.alias && c.alias.startsWith(query))
      );
      setFilteredSuggests(filtered);
      setShowCommandSuggest(filtered.length > 0);
    } else {
      setShowCommandSuggest(false);
    }
  };

  const handleCommandSelect = (cmd: string) => {
    setInput(cmd + " ");
    setShowCommandSuggest(false);
  };

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pastedImage) || isGenerating) return;

    onSendMessage(input, useReformulate, useHeadless, pastedImage);
    setInput('');
    setPastedImage(null);
    setShowCommandSuggest(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setPastedImage(event.target.result as string);
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3 border-t border-zinc-200 bg-zinc-50/50 select-none relative"
      style={{
        transform: 'translateZ(0)',
        willChange: 'transform',
        contain: 'content',
      }}
    >
      <AnimatePresence>
        {showCommandSuggest && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 p-1"
          >
            <div className="px-2 py-0.5 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Slash Commands</div>
            {filteredSuggests.map((c) => (
              <button
                key={c.cmd}
                type="button"
                onClick={() => handleCommandSelect(c.cmd)}
                className="w-full text-left px-2 py-1 hover:bg-zinc-50 rounded-md flex items-center justify-between text-[11px] cursor-pointer font-semibold transition-colors text-zinc-700"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-blue-600 font-mono font-bold">{c.cmd}</span>
                  {c.alias && <span className="text-[9px] text-zinc-400 font-mono">({c.alias})</span>}
                </div>
                <span className="text-[9px] text-zinc-500">{c.desc}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {pastedImage && (
        <div className="relative inline-block mb-2.5 group animate-fade-in">
          <img
            src={pastedImage}
            alt="Pasted Thumbnail"
            className="max-h-20 max-w-[160px] rounded-lg border border-zinc-200 shadow-md object-contain bg-zinc-50 p-0.5"
          />
          <button
            type="button"
            onClick={() => setPastedImage(null)}
            className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-650 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px] font-bold shadow-md transition-all cursor-pointer"
            title="Xóa hình ảnh"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main input container with integrated options */}
      <div
        className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 flex flex-col focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-300/30 transition-[border-color,box-shadow] duration-200 shadow-sm relative"
        style={{ contain: 'content' }}
      >
        <textarea
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Nhập tin nhắn... (dùng / để xem phím tắt)"
          rows={1}
          className="w-full bg-transparent border-none outline-none resize-none text-[12px] text-zinc-800 placeholder-zinc-400 p-1 leading-relaxed mb-0.5 min-h-[24px] max-h-32"
        />

        <div className="flex justify-between items-center border-t border-zinc-200/60 pt-2 mt-1 flex-wrap gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              className="w-6 h-6 rounded-md border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 flex items-center justify-center font-semibold text-xs cursor-pointer transition-colors shadow-xs"
              title="Thêm tệp đính kèm"
            >
              +
            </button>

            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                className="flex items-center gap-1 bg-white border border-zinc-200 hover:border-zinc-300 rounded-md px-2 py-0.5 shadow-xs transition-[border-color,background-color] duration-200 cursor-pointer select-none"
              >
                <span className="text-[10px]">
                  {activeAgent === "MaxHermes" ? "🤖" : "👾"}
                </span>
                <span className="text-[9px] font-bold text-zinc-700 font-mono">
                  {activeAgent}
                </span>
                <span className="text-[8px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1">
                  {currentActiveModelName}
                </span>
                <span className="text-[7px] text-zinc-400">▼</span>
              </button>

              {showModelDropdown && (
                <div className="absolute bottom-full left-0 mb-1.5 w-48 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 z-50 text-[11px] font-semibold text-zinc-700">
                  <div className="px-2 py-0.5 text-[7px] uppercase tracking-wider text-zinc-400">Nhà cung cấp</div>
                  {realProviders.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        handleSwitchProvider(p.key, p.name);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-2 py-1 hover:bg-zinc-50 flex items-center justify-between cursor-pointer ${currentActiveModelName === p.name ? "text-blue-600 bg-blue-50 font-bold" : "text-zinc-650"
                        }`}
                    >
                      <span>{p.name}</span>
                      {currentActiveModelName === p.name && <span className="text-[8px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Compact Toggle: Reformulate */}
            <button
              type="button"
              onClick={() => setUseReformulate(!useReformulate)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border transition-all cursor-pointer select-none ${
                useReformulate
                  ? "bg-blue-50 border-blue-200 text-blue-600"
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
              }`}
              title="Tự động tối ưu hóa câu hỏi"
            >
              ✨ Ref: {useReformulate ? "ON" : "OFF"}
            </button>

            {/* Compact Toggle: Headless */}
            <button
              type="button"
              onClick={() => setUseHeadless(!useHeadless)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border transition-all cursor-pointer select-none ${
                useHeadless
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                  : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
              }`}
              title="Chạy trình duyệt ẩn danh không giao diện"
            >
              ⚡ Headless: {useHeadless ? "ON" : "OFF"}
            </button>
          </div>

          <button
            type="submit"
            onClick={isGenerating ? stopGeneration : undefined}
            className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold p-0 cursor-pointer shadow-sm transition-transform duration-200 active:scale-95 hover:scale-105 ${isGenerating ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            title={isGenerating ? "Dừng phản hồi" : "Gửi tin nhắn"}
          >
            {isGenerating ? '■' : '↑'}
          </button>
        </div>
      </div>
    </form>
  );
});
ChatInputForm.displayName = "ChatInputForm";

interface WebTerminalProps {
  activeAgent: "MaxHermes" | "MaxClaw";
  activeModel: string;
  setActiveModel: (model: string) => void;
  sse: ReturnType<typeof useSSE>;
  workspaceData: WorkspaceData | null;
}

export function WebTerminal({ activeAgent, activeModel, setActiveModel, sse, workspaceData }: WebTerminalProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollTopRef = useRef<number>(0);
  const shouldAutoScrollRef = useRef<boolean>(true);

  const [realProviders, setRealProviders] = useState<ProviderInfo[]>([]);
  const [availableCommands, setAvailableCommands] = useState<CommandInfo[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { messages, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration, setLogs } = sse;
  const chatEndRef = useRef<HTMLDivElement>(null);

  const lastValidatedMessageRef = useRef<string | null>(null);
  const fixAttemptsRef = useRef<number>(0);

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const currentScrollTop = container.scrollTop;
    const isScrollingUp = currentScrollTop < lastScrollTopRef.current;

    lastScrollTopRef.current = currentScrollTop;

    const threshold = 100;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

    if (isNearBottom) {
      shouldAutoScrollRef.current = true;
    } else if (isScrollingUp) {
      shouldAutoScrollRef.current = false;
    }
  };

  useEffect(() => {
    const innerContainer = innerContainerRef.current;
    if (!innerContainer) return;

    const resizeObserver = new ResizeObserver(() => {
      if (shouldAutoScrollRef.current) {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    resizeObserver.observe(innerContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    fetch('/api/provider/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.providers) {
          const enabledList = Object.entries(data.providers)
            .filter(([_, p]: any) => p.enabled)
            .map(([key, p]: any) => ({
              key,
              name: p.name || key
            }));
          setRealProviders(enabledList);
        }
      })
      .catch((err) => console.error("Lỗi đồng bộ danh sách AI Providers:", err));

    fetch('/api/dashboard/commands')
      .then((res) => res.json())
      .then((data) => {
        if (data.cli) {
          setAvailableCommands(data.cli);
        }
      })
      .catch((err) => console.error("Could not load commands database:", err));
  }, []);

  const handleSwitchProvider = useCallback((providerKey: string, providerName: string) => {
    fetch('/api/provider/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerKey })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setActiveModel(providerName);
          setLogs((prev) => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            text: `🔄 Đã chuyển đổi nóng nhà cung cấp AI thành công sang: ${providerName}`,
            type: 'default'
          }]);
        }
      })
      .catch((err) => console.error("Gặp sự cố khi chuyển nhà cung cấp:", err));
  }, [setActiveModel, setLogs]);

  useEffect(() => {
    if (!isGenerating && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.content !== lastValidatedMessageRef.current) {
        lastValidatedMessageRef.current = lastMsg.content;

        const regex = /```mermaid\n([\s\S]*?)```/g;
        const blocks: string[] = [];
        let match;
        while ((match = regex.exec(lastMsg.content)) !== null) {
          blocks.push(match[1]);
        }

        if (blocks.length > 0) {
          const validateAll = async () => {
            const { default: mermaidInst } = await import('mermaid');
            for (let i = 0; i < blocks.length; i++) {
              const block = blocks[i];
              try {
                await mermaidInst.parse(block);
              } catch (err: any) {
                console.warn("Syntax error in Mermaid detected:", err);
                const errMsg = err.message || String(err);

                if (fixAttemptsRef.current < 2) {
                  fixAttemptsRef.current += 1;

                  setLogs((prev) => [...prev, {
                    timestamp: new Date().toLocaleTimeString(),
                    text: `⚠️ Lỗi cú pháp Mermaid. Đang gửi yêu cầu AI tự động sửa (lần ${fixAttemptsRef.current}/2)...`,
                    type: 'error'
                  }]);

                  const systemFeedback = `[HỆ THỐNG]: Sơ đồ Mermaid số ${i + 1} bạn vừa tạo bị lỗi cú pháp. Vui lòng sửa lại sơ đồ này.
LỖI CHI TIẾT:
${errMsg}

MÃ NGUỒN GỐC GÂY LỖI:
\`\`\`mermaid
${block}
\`\`\``;

                  setTimeout(() => {
                    sendPrompt(systemFeedback, false, null, activeAgent, activeModel, true);
                  }, 1500);
                }
                break;
              }
            }
          };
          validateAll();
        } else {
          fixAttemptsRef.current = 0;
        }
      }
    }
  }, [isGenerating, messages, sendPrompt, setLogs, activeAgent, activeModel]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = useCallback((
    prompt: string,
    useReformulate: boolean,
    useHeadless: boolean,
    pastedImage: string | null
  ) => {
    shouldAutoScrollRef.current = true;
    sendPrompt(prompt, useReformulate, pastedImage, activeAgent, activeModel, useHeadless);
  }, [sendPrompt, activeAgent, activeModel]);

  const activePipeline = workspaceData?.pipeline;
  const runningStepKey = workspaceData?.activeTask?.step_key || '';
  const currentStepMap = workspaceData?.states || [];
  const currentActiveModelName = workspaceData?.provider?.name || activeModel;

  return (
    <div className={`flex-1 grid grid-cols-1 ${isSidebarOpen ? 'xl:grid-cols-[1fr_260px]' : 'xl:grid-cols-1'} h-full overflow-hidden bg-white border-l border-zinc-200 select-text text-zinc-800`}>
      <div className="flex flex-col h-full overflow-hidden border-r border-zinc-200">
        <header className="px-4 py-3 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 select-none">
          <div>
            <h2 className="text-xs font-bold text-zinc-900">Tối ưu kỹ năng chat</h2>
            <p className="text-[9px] text-zinc-500 font-medium mt-0.5">Active Workspace Turn Session</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
              <span className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
              <span>{isGenerating ? "AI Processing" : "Synced Active"}</span>
            </div>

            {/* Compact Toggle Sidebar Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="px-2 py-1 bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-655 hover:text-zinc-800 rounded text-[10px] font-semibold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
              title={isSidebarOpen ? "Ẩn thanh bên" : "Hiện thanh bên"}
            >
              {isSidebarOpen ? "👉 Thanh bên" : "👈 Thanh bên"}
            </button>
          </div>
        </header>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 scrollbar-thin bg-white"
          style={{
            transform: 'translateZ(0)',
            willChange: 'transform',
            contain: 'content'
          }}
        >
          <div ref={innerContainerRef} className="space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-24 text-center select-none">
                <span className="text-3xl mb-2 animate-bounce">💬</span>
                <p className="text-xs font-semibold text-zinc-600">Chưa có hội thoại.</p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-sm leading-relaxed">
                  Nhập tin nhắn đầu tiên bên dưới hoặc dùng ký tự <code className="text-blue-600 bg-zinc-100 px-1 py-0.5 rounded">/</code> để sử dụng các phím tắt hệ thống.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isLastMessage = idx === messages.length - 1;
                const isCurrentlyGeneratingThis = isLastMessage && isGenerating;

                return (
                  <div
                    key={idx}
                    className={`flex flex-col space-y-2 max-w-[85%] text-sm ${msg.role === 'user' ? 'ml-auto' : 'mr-auto w-full'}`}
                  >
                    {msg.image && (
                      <div className="mb-1 self-end">
                        <img
                          src={msg.image}
                          alt="Uploaded visual data"
                          className="max-h-48 rounded-lg border border-zinc-200 object-contain shadow-md bg-zinc-50 p-0.5"
                        />
                      </div>
                    )}

                    {msg.role === 'assistant' ? (
                      <div className="space-y-2.5 w-full flex flex-col items-start">
                        {getMessageTimeline(msg, idx).map((item) => {
                          if (item.type === 'steps' && item.steps && item.steps.length > 0) {
                            return (
                              <CollapsibleSteps
                                key={item.id}
                                steps={item.steps}
                                forceExpand={isCurrentlyGeneratingThis}
                              />
                            );
                          } else if (item.type === 'text' && item.content && item.content.trim()) {
                            return (
                              <div
                                key={item.id}
                                className="p-3 rounded-xl bg-white border border-zinc-200 text-zinc-800 shadow-xs self-start rounded-tl-xs w-full text-left"
                              >
                                <TimelineTextBlock content={item.content} />
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    ) : (
                      <div
                        className={`p-3 rounded-xl ${msg.role === 'user'
                          ? 'bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-xs self-end rounded-tr-xs'
                          : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm self-start rounded-tl-xs w-full'
                          }`}
                      >
                        <TimelineTextBlock content={msg.content} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {pendingPermission && (
          <div className="mx-4 mb-3 p-4 bg-white border border-zinc-200 rounded-xl space-y-3 shadow-md text-left relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-amber-500" />

            {(() => {
              let structuredQuestions = null;
              if (pendingPermission.details && pendingPermission.details.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(pendingPermission.details);
                  if (parsed.type === 'structured_questions') {
                    structuredQuestions = parsed;
                  }
                } catch (e) {
                  // ignore
                }
              }

              if (structuredQuestions) {
                return (
                  <>
                    <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px]">
                      <span className="animate-pulse">❓</span> YÊU CẦU LÀM RÕ THÔNG TIN (STRUCTURED WIZARD)
                    </div>
                    <StructuredQuestionsForm
                      data={structuredQuestions}
                      onSubmit={(ans) => respondToPermission(pendingPermission.id, JSON.stringify(ans))}
                      onCancel={() => respondToPermission(pendingPermission.id, 'n')}
                    />
                  </>
                );
              }

              return (
                <>
                  <div className="flex items-center gap-1.5 text-amber-600 font-bold text-[11px]">
                    <span className="animate-pulse">⚠️</span> YÊU CẦU PHÊ DUYỆT WORKFLOW
                  </div>
                  <p className="text-[11px] text-zinc-700 leading-relaxed font-semibold">
                    {pendingPermission.query}
                  </p>
                  {pendingPermission.details && (
                    <pre className="p-2 bg-zinc-50 border border-zinc-200 text-[9px] text-zinc-500 font-mono rounded overflow-auto max-h-24 whitespace-pre-wrap">
                      {pendingPermission.details}
                    </pre>
                  )}
                  <div className="flex gap-1.5 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 text-[9px] h-7 px-2 cursor-pointer"
                      onClick={() => respondToPermission(pendingPermission.id, 'n')}
                    >
                      Từ chối
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50 text-[9px] h-7 px-2 cursor-pointer"
                      onClick={() => respondToPermission(pendingPermission.id, 'y')}
                    >
                      Đồng ý (Yes)
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="text-[9px] h-7 px-2.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer border-none"
                      onClick={() => respondToPermission(pendingPermission.id, 'a')}
                    >
                      Đồng ý tất cả
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <ChatInputForm
          activeAgent={activeAgent}
          currentActiveModelName={currentActiveModelName}
          realProviders={realProviders}
          handleSwitchProvider={handleSwitchProvider}
          isGenerating={isGenerating}
          stopGeneration={stopGeneration}
          availableCommands={availableCommands}
          onSendMessage={handleSendMessage}
        />
      </div>

      <AnimatePresence>
        {isSidebarOpen && (
          <aside className="hidden xl:flex flex-col w-64 border-l border-zinc-200 bg-zinc-50/50 h-full p-4 overflow-y-auto select-none shrink-0 transition-all duration-300">
            <div className="space-y-5 text-left">
              {activePipeline ? (
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center pb-1.5 border-b border-zinc-200">
                    <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live Pipeline
                    </h3>
                    <span className="text-[8px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.2 rounded border border-blue-200 font-mono">
                      {activePipeline.status}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-zinc-800 line-clamp-1">{activePipeline.pipeline_name}</h4>
                    <p className="text-[9px] text-zinc-400 font-medium">Auto-executing workspace state</p>
                  </div>

                  <div className="space-y-3 pt-1">
                    {activePipeline.stages.map((stage, sIdx) => {
                      const runningInStage = stage.steps.some(st => st.step_key === runningStepKey);
                      return (
                        <div key={sIdx} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-zinc-700">
                              {sIdx + 1}. {stage.name}
                            </span>
                            <span className={`text-[8px] px-1 py-0.2 rounded font-mono ${stage.status === 'DONE' ? 'text-emerald-600 bg-emerald-50' : runningInStage ? 'text-amber-600 bg-amber-5' : 'text-zinc-400 bg-zinc-100'
                              }`}>
                              {stage.status}
                            </span>
                          </div>

                          <div className="space-y-1 pl-1.5 border-l border-zinc-200 ml-1">
                            {stage.steps.map((step) => {
                              const stateRow = currentStepMap.find(s => s.step_key === step.step_key);
                              const stepState = stateRow ? stateRow.state : 'PENDING';
                              const isRunning = step.step_key === runningStepKey;

                              const statusColors = {
                                PENDING: 'text-zinc-400',
                                QUEUED: 'text-zinc-500 font-medium',
                                RUNNING: 'text-amber-600 font-bold',
                                VALIDATING: 'text-cyan-600 font-bold',
                                DONE: 'text-emerald-600',
                                FAILED: 'text-red-600',
                                BLOCKED: 'text-purple-600'
                              };

                              return (
                                <div key={step.step_key} className="flex items-start gap-1.5 py-0.5 text-[10px]">
                                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${stepState === 'DONE' ? 'bg-emerald-500' : isRunning ? 'bg-amber-500 animate-ping' : 'bg-zinc-200'
                                    }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-zinc-700 truncate font-semibold leading-tight">{step.task}</p>
                                    <div className="flex gap-1.5 mt-0.5 text-[8px] font-mono">
                                      <span className="text-zinc-400 truncate max-w-[80px]">{step.tool}</span>
                                      <span className={statusColors[stepState] || 'text-zinc-400'}>{stepState}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center pb-1.5 border-b border-zinc-200">
                    <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Agents
                    </h3>
                    <span className="text-[8px] text-zinc-400 font-bold font-mono">
                      Online
                    </span>
                  </div>

                  <div className="space-y-3">
                    {workspaceData?.agents.map((agent) => {
                      const state = agent.status.state;
                      const isBusy = state === 'running' || state === 'thinking';

                      return (
                        <div
                          key={agent.id}
                          className={`p-2.5 rounded-lg border transition-all duration-300 ${isBusy
                            ? 'bg-zinc-50 border-zinc-300 shadow-xs'
                            : 'bg-white border-zinc-200 hover:bg-zinc-50'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="text-xs shrink-0">
                                {agent.type === 'orchestrator' ? '👑' : agent.id === 'critic' ? '⚖️' : agent.id === 'validator' ? '🛡️' : '⚙️'}
                              </span>
                              <span className="text-[11px] font-bold text-zinc-800 truncate">{agent.name}</span>
                            </div>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${state === 'running'
                              ? 'bg-emerald-500 glow-emerald'
                              : state === 'waiting'
                                ? 'bg-amber-500 animate-pulse'
                                : 'bg-zinc-300'
                              }`} />
                          </div>

                          <div className="space-y-0.5 text-[8px] font-mono text-zinc-500">
                            <div className="flex justify-between">
                              <span>Role:</span>
                              <span className="text-zinc-650 uppercase">{agent.type}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Model:</span>
                              <span className="text-blue-600 truncate max-w-[100px]">{agent.model}</span>
                            </div>
                            {agent.status.currentTask && (
                              <div className="pt-1 mt-1 border-t border-zinc-100">
                                <span className="text-[7px] uppercase tracking-wider text-zinc-400 block mb-0.5">Active Task:</span>
                                <span className="text-zinc-700 font-sans font-medium text-[9px] leading-tight block line-clamp-2 select-text">
                                  {agent.status.currentTask}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </AnimatePresence>
    </div>
  );
}