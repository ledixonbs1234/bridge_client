import React, { useState, useRef, useEffect } from 'react';
import { useSSE, ChatMessage, ExecutionStep } from '@/hooks/useSSE';
import { Button } from './animate-ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { marked } from 'marked';
import { MermaidRenderer } from './MermaidRenderer';
import { WorkspaceData } from '../App';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${checked ? "bg-blue-600" : "bg-zinc-200"
        }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 ${checked ? "translate-x-4.5" : "translate-x-0.5"
          }`}
      />
    </button>
  );
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

function CollapsibleSteps({ steps }: { steps: ExecutionStep[] }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});

  if (!steps || steps.length === 0) return null;

  const thinkingCount = steps.filter(s => s.type === 'thinking').length;
  const fileCount = steps.filter(s => s.type === 'read_file').length;
  const commandCount = steps.filter(s => s.type === 'terminal' || s.type === 'search').length;

  const toggleStep = (stepId: string) => {
    setCollapsedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div className="my-3 text-left select-none max-w-full">
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer py-2 px-3 bg-zinc-50 border border-zinc-200 rounded-xl shadow-xs"
      >
        <span
          className="text-[10px] text-zinc-400 transition-transform duration-200"
          style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)' }}
        >
          ▶
        </span>
        <span>
          Thought {thinkingCount} time(s), Viewed {fileCount} file(s), Ran {commandCount} command(s)
        </span>
      </button>

      {!isCollapsed && (
        <div className="mt-3 pl-3.5 border-l-2 border-zinc-200 space-y-4 max-w-full">
          {steps.map((step) => {
            const isStepExpanded = !collapsedSteps[step.id];
            const icon = step.type === 'thinking' ? '🧠' : step.type === 'read_file' ? '📄' : step.type === 'search' ? '🔍' : '💻';

            return (
              <div key={step.id} className="border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => toggleStep(step.id)}
                  className="flex items-center justify-between w-full p-3 bg-zinc-50/50 hover:bg-zinc-100/60 text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 overflow-hidden mr-2">
                    <span className="text-sm shrink-0">{icon}</span>
                    <span className="text-xs font-bold text-zinc-700 font-mono truncate">
                      {step.title}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-450 font-semibold shrink-0">
                    {isStepExpanded ? 'Thu gọn [-]' : 'Mở rộng [+]'}
                  </span>
                </button>

                {isStepExpanded && (
                  <div className="border-t border-zinc-200 p-4 bg-zinc-50/10 text-xs text-zinc-800 space-y-4 select-text font-mono">
                    {step.type === 'thinking' && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Thinking process</div>
                        <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-600 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                          {step.input}
                        </pre>
                      </div>
                    )}

                    {step.type === 'terminal' && (
                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terminal Input</div>
                          <pre className="p-3 bg-zinc-950 text-emerald-400 border border-zinc-900 rounded-lg text-xs whitespace-pre-wrap">
                            {step.input}
                          </pre>
                        </div>
                        {step.output && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Terminal Output</div>
                            <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
                              {step.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {step.type === 'read_file' && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">File Content</div>
                        <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 whitespace-pre-wrap max-h-96 overflow-y-auto overflow-x-auto leading-relaxed">
                          {step.output || 'Đang tải nội dung file...'}
                        </pre>
                      </div>
                    )}

                    {step.type === 'search' && (
                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Search Input</div>
                          <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-600 whitespace-pre-wrap">
                            {step.input}
                          </pre>
                        </div>
                        {step.output && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Search Result</div>
                            <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
                              {step.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {step.type === 'generic' && (
                      <div className="space-y-3.5">
                        {step.input && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Input</div>
                            <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-650 whitespace-pre-wrap">
                              {step.input}
                            </pre>
                          </div>
                        )}
                        {step.output && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Result</div>
                            <pre className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed">
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
}

interface WebTerminalProps {
  activeAgent: "MaxHermes" | "MaxClaw";
  activeModel: string;
  setActiveModel: (model: string) => void;
  sse: ReturnType<typeof useSSE>;
  workspaceData: WorkspaceData | null;
}

interface CommandInfo {
  cmd: string;
  alias: string | null;
  desc: string;
  category: string;
}

interface ProviderInfo {
  key: string;
  name: string;
}

export function WebTerminal({ activeAgent, activeModel, setActiveModel, sse, workspaceData }: WebTerminalProps) {
  const [input, setInput] = useState('');
  const [useReformulate, setUseReformulate] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef<boolean>(true);
  const [useHeadless, setUseHeadless] = useState(false); // THÊM DÒNG NÀY: State quản lý Headless mode
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // Thêm quản lý danh sách AI thực tế nạp từ Server
  const [realProviders, setRealProviders] = useState<ProviderInfo[]>([]);

  // Command auto-complete states
  const [availableCommands, setAvailableCommands] = useState<CommandInfo[]>([]);
  const [showCommandSuggest, setShowCommandSuggest] = useState(false);
  const [filteredSuggests, setFilteredSuggests] = useState<CommandInfo[]>([]);

  const { messages, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration, setLogs } = sse;
  const chatEndRef = useRef<HTMLDivElement>(null);

  const lastValidatedMessageRef = useRef<string | null>(null);
  const fixAttemptsRef = useRef<number>(0);
  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Tính toán khoảng cách từ thanh cuộn hiện tại đến đáy của div container
    const threshold = 50; // Ngưỡng dung sai pixel (50px) để nhận diện ở đáy
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;

    // Cập nhật trạng thái tự động cuộn dựa trên vị trí cuộn thực tế của người dùng
    shouldAutoScrollRef.current = isAtBottom;
  };
  // 1. Quét danh sách các Nhà cung cấp AI (Providers) thực tế từ Server
  useEffect(() => {
    fetch('/api/provider/config')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.providers) {
          // Lọc các nhà cung cấp đang ở trạng thái kích hoạt (enabled: true)
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

  // 2. Hàm kích hoạt chuyển đổi nóng (Hot-swapping Switch) AI Provider trên Server
  const handleSwitchProvider = (providerKey: string, providerName: string) => {
    fetch('/api/provider/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: providerKey })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Cập nhật nhãn hiển thị tại nút bấm đại diện
          setActiveModel(providerName);
          setShowModelDropdown(false);
          setLogs((prev) => [...prev, {
            timestamp: new Date().toLocaleTimeString(),
            text: `🔄 Đã chuyển đổi nóng nhà cung cấp AI thành công sang: ${providerName}`,
            type: 'default'
          }]);
        }
      })
      .catch((err) => console.error("Gặp sự cố khi chuyển nhà cung cấp:", err));
  };

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
                    // SỬA: Bổ sung tham số useHeadless vào cuối để đồng bộ trạng thái chạy ngầm khi AI tự sửa code
                    sendPrompt(systemFeedback, false, null, activeAgent, activeModel, useHeadless);
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
    // Chỉ tự động cuộn xuống dưới cùng nếu người dùng đang ở đáy
    if (shouldAutoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
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

    // ÉP BUỘC bật lại chế độ tự động cuộn khi người dùng chủ động gửi câu hỏi mới
    shouldAutoScrollRef.current = true;

    sendPrompt(input, useReformulate, pastedImage, activeAgent, activeModel, useHeadless);
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

  const activePipeline = workspaceData?.pipeline;
  const runningStepKey = workspaceData?.activeTask?.step_key || '';
  const currentStepMap = workspaceData?.states || [];

  // Đồng bộ nhãn hiển thị mô hình thực tế từ bối cảnh kết nối của server
  const currentActiveModelName = workspaceData?.provider?.name || activeModel;

  return (
    <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_300px] h-full overflow-hidden bg-white border-l border-zinc-200 select-text text-zinc-800">
      <div className="flex flex-col h-full overflow-hidden border-r border-zinc-200">
        <header className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 select-none">
          <div>
            <h2 className="text-sm font-bold text-zinc-900">Tối ưu kỹ năng chat</h2>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Active Workspace Turn Session</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
            <span className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
            <span>{isGenerating ? "AI Processing" : "Synced Active"}</span>
          </div>
        </header>

        <div
          ref={scrollContainerRef} // Gắn ref theo dõi DOM
          onScroll={handleScroll}   // Lắng nghe sự kiện cuộn chuột
          className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin bg-white"
        >
          {messages.length === 0 ? (  
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 py-32 text-center select-none">
              <span className="text-4xl mb-3 animate-bounce">💬</span>
              <p className="text-sm font-semibold text-zinc-600">Chưa có hội thoại.</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm leading-relaxed">
                Nhập tin nhắn đầu tiên bên dưới. Bạn có thể sử dụng dấu <code className="text-blue-600 bg-zinc-100 px-1 py-0.5 rounded">/</code> để gọi các lệnh hệ thống nhanh.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col space-y-2.5 max-w-[90%] text-sm ${msg.role === 'user' ? 'ml-auto' : 'mr-auto w-full'}`}
              >
                {msg.image && (
                  <div className="mb-1 self-end">
                    <img
                      src={msg.image}
                      alt="Uploaded visual data"
                      className="max-h-56 rounded-xl border border-zinc-200 object-contain shadow-md bg-zinc-50 p-0.5"
                    />
                  </div>
                )}

                {msg.role === 'assistant' && msg.steps && msg.steps.length > 0 && (
                  <CollapsibleSteps steps={msg.steps} />
                )}

                <div
                  className={`p-4 rounded-2xl ${msg.role === 'user'
                    ? 'bg-zinc-100 border border-zinc-200 text-zinc-900 shadow-xs self-end rounded-tr-xs'
                    : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm self-start rounded-tl-xs w-full'
                    }`}
                >
                  {(() => {
                    const cleanContent = msg.content
                      .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
                      .trim();

                    const parts = parseContentAndMermaid(cleanContent);

                    return (
                      <div className="space-y-4">
                        {parts.map((part, partIdx) => {
                          if (part.type === 'mermaid') {
                            return (
                              <div key={partIdx} className="my-2">
                                <MermaidRenderer code={part.content} />
                              </div>
                            );
                          }
                          const htmlContent = marked.parse(part.content) as string;
                          return (
                            <div
                              key={partIdx}
                              className="markdown-body-light text-left leading-relaxed text-sm select-text"
                              dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {pendingPermission && (
          <div className="mx-6 mb-4 p-4 bg-zinc-50 border border-amber-500/30 rounded-xl space-y-3 shadow-md text-left">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
              <span className="animate-pulse">⚠️</span> YÊU CẦU PHÊ DUYỆT WORKFLOW
            </div>
            <p className="text-xs text-zinc-700 leading-relaxed font-semibold">
              {pendingPermission.query}
            </p>
            {pendingPermission.details && (
              <pre className="p-2.5 bg-white border border-zinc-200 text-[10px] text-zinc-500 font-mono rounded overflow-auto max-h-32 whitespace-pre-wrap">
                {pendingPermission.details}
              </pre>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 text-[10px] h-8 px-2.5 cursor-pointer"
                onClick={() => respondToPermission(pendingPermission.id, 'n')}
              >
                Từ chối
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-200 hover:bg-blue-50 text-[10px] h-8 px-2.5 cursor-pointer"
                onClick={() => respondToPermission(pendingPermission.id, 'y')}
              >
                Đồng ý (Yes)
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-[10px] h-8 px-2.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer border-none"
                onClick={() => respondToPermission(pendingPermission.id, 'a')}
              >
                Đồng ý tất cả
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 bg-zinc-50/50 select-none relative">

          {/* Autocomplete Suggestion Box */}
          <AnimatePresence>
            {showCommandSuggest && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 p-1.5"
              >
                <div className="px-2.5 py-1 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Hệ thống Slash Commands</div>
                {filteredSuggests.map((c) => (
                  <button
                    key={c.cmd}
                    type="button"
                    onClick={() => handleCommandSelect(c.cmd)}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-zinc-50 rounded-lg flex items-center justify-between text-xs cursor-pointer font-semibold transition-colors text-zinc-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-blue-600 font-mono font-bold">{c.cmd}</span>
                      {c.alias && <span className="text-[10px] text-zinc-400 font-mono">(alias: {c.alias})</span>}
                    </div>
                    <span className="text-[10px] text-zinc-500">{c.desc}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-6 mb-3 select-none">
            <div className="flex items-center gap-3">
              <Switch checked={useReformulate} onChange={setUseReformulate} />
              <span className="text-xs font-semibold text-zinc-500">
                Tối ưu câu hỏi (Reformulate)
              </span>
            </div>

            {/* THÊM KHỐI NÀY: Switch bật tắt chế độ chạy ngầm */}
            <div className="flex items-center gap-3">
              <Switch checked={useHeadless} onChange={setUseHeadless} />
              <span className="text-xs font-semibold text-zinc-500">
                Chế độ chạy ngầm (Headless)
              </span>
            </div>
          </div>

          {pastedImage && (
            <div className="relative inline-block mb-3 group animate-fade-in">
              <img
                src={pastedImage}
                alt="Pasted Thumbnail"
                className="max-h-24 max-w-[200px] rounded-lg border border-zinc-200 shadow-md object-contain bg-zinc-50 p-1"
              />
              <button
                type="button"
                onClick={() => setPastedImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-650 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md transition-all cursor-pointer"
                title="Xóa hình ảnh"
              >
                ✕
              </button>
            </div>
          )}

          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-2.5 flex flex-col focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-300/30 transition-all shadow-md relative">
            <textarea
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Nhập tin nhắn... (dùng / để hiển thị danh sách các lệnh nhanh)"
              rows={2}
              className="w-full bg-transparent border-none outline-none resize-none text-xs text-zinc-800 placeholder-zinc-400 p-1 leading-relaxed mb-1"
            />

            <div className="flex justify-between items-center border-t border-zinc-200/60 pt-2.5 mt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-7 h-7 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 flex items-center justify-center font-semibold text-xs cursor-pointer transition-colors shadow-sm"
                  title="Thêm tệp đính kèm"
                >
                  +
                </button>

                {/* Agent Team Trigger Component */}
                <div className="relative inline-block text-left">
                  <button
                    type="button"
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex items-center gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 py-1 shadow-sm transition-all cursor-pointer select-none"
                  >
                    <span className="text-xs">
                      {activeAgent === "MaxHermes" ? "🤖" : "👾"}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-700 font-mono">
                      {activeAgent}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1 py-0.2">
                      {currentActiveModelName}
                    </span>
                    <span className="text-[8px] text-zinc-400">▼</span>
                  </button>

                  {showModelDropdown && (
                    <div className="absolute bottom-full left-0 mb-1.5 w-52 bg-white border border-zinc-200 rounded-xl shadow-xl py-1 z-50 text-xs font-semibold text-zinc-700">
                      <div className="px-3 py-1 text-[8px] uppercase tracking-wider text-zinc-400">Chọn Nhà cung cấp thực tế</div>
                      {realProviders.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handleSwitchProvider(p.key, p.name)}
                          className={`w-full text-left px-3 py-1.5 hover:bg-zinc-50 flex items-center justify-between cursor-pointer ${currentActiveModelName === p.name ? "text-blue-600 bg-blue-50 font-bold" : "text-zinc-650"
                            }`}
                        >
                          <span>{p.name}</span>
                          {currentActiveModelName === p.name && <span className="text-[9px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                variant={isGenerating ? "destructive" : "default"}
                onClick={isGenerating ? stopGeneration : undefined}
                className="h-7 w-7 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold p-0 cursor-pointer shadow-md transition-transform hover:scale-105"
                title={isGenerating ? "Dừng phản hồi" : "Gửi tin nhắn"}
              >
                {isGenerating ? '■' : '↑'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* 🚀 REAL-TIME SYNCHRONIZED BACKEND MONITOR SIDEBAR */}
      <aside className="hidden xl:flex flex-col w-75 border-l border-zinc-200 bg-zinc-50/50 h-full p-5 overflow-y-auto select-none shrink-0">
        <div className="space-y-6 text-left">
          {activePipeline ? (
            // LIVE PIPELINE PROGRESS TRACKER
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live Pipeline
                </h3>
                <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                  {activePipeline.status}
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-xs font-bold text-zinc-800 line-clamp-1">{activePipeline.pipeline_name}</h4>
                <p className="text-[10px] text-zinc-400 font-medium">Auto-executing active workspace state</p>
              </div>

              <div className="space-y-4 pt-2">
                {activePipeline.stages.map((stage, sIdx) => {
                  const runningInStage = stage.steps.some(st => st.step_key === runningStepKey);
                  return (
                    <div key={sIdx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-700">
                          {sIdx + 1}. {stage.name}
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${stage.status === 'DONE' ? 'text-emerald-600 bg-emerald-50' : runningInStage ? 'text-amber-600 bg-amber-5' : 'text-zinc-400 bg-zinc-100'
                          }`}>
                          {stage.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 pl-2 border-l border-zinc-200 ml-1">
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
                            <div key={step.step_key} className="flex items-start gap-2 py-0.5 text-[11px]">
                              <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${stepState === 'DONE' ? 'bg-emerald-500' : isRunning ? 'bg-amber-500 animate-ping' : 'bg-zinc-200'
                                }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-zinc-700 truncate font-semibold leading-tight">{step.task}</p>
                                <div className="flex gap-2 mt-0.5 text-[9px] font-mono">
                                  <span className="text-zinc-400">{step.tool}</span>
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
            // DYNAMIC ACTIVE AGENTS TEAM HUB
            <div className="space-y-5 animate-fade-in">
              <div className="flex justify-between items-center pb-2 border-b border-zinc-200">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Agents
                </h3>
                <span className="text-[9px] text-zinc-400 font-bold font-mono">
                  Online
                </span>
              </div>

              <div className="space-y-4">
                {workspaceData?.agents.map((agent) => {
                  const state = agent.status.state;
                  const isBusy = state === 'running' || state === 'thinking';

                  return (
                    <div
                      key={agent.id}
                      className={`p-3 rounded-xl border transition-all duration-300 ${isBusy
                        ? 'bg-zinc-50 border-zinc-300 shadow-sm'
                        : 'bg-white border-zinc-200 hover:bg-zinc-50'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs shrink-0">
                            {agent.type === 'orchestrator' ? '👑' : agent.id === 'critic' ? '⚖️' : agent.id === 'validator' ? '🛡️' : '⚙️'}
                          </span>
                          <span className="text-xs font-bold text-zinc-800 truncate">{agent.name}</span>
                        </div>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${state === 'running'
                          ? 'bg-emerald-500 glow-emerald'
                          : state === 'waiting'
                            ? 'bg-amber-500 animate-pulse'
                            : 'bg-zinc-300'
                          }`} />
                      </div>

                      <div className="space-y-1 text-[9px] font-mono text-zinc-500">
                        <div className="flex justify-between">
                          <span>Role:</span>
                          <span className="text-zinc-600 uppercase">{agent.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Model:</span>
                          <span className="text-blue-600 truncate max-w-[120px]">{agent.model}</span>
                        </div>
                        {agent.status.currentTask && (
                          <div className="pt-1 mt-1 border-t border-zinc-100">
                            <span className="text-[8px] uppercase tracking-wider text-zinc-400 block mb-0.5">Active Task:</span>
                            <span className="text-zinc-700 font-sans font-medium text-[10px] leading-tight block line-clamp-2 select-text">
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
    </div>
  );
}