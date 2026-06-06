// filepath: ridge_client/src/components/WebTerminal.tsx
import * as React from "react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSSE, ChatMessage, TimelineItem } from "@/hooks/useSSE";
import { Button } from "./animate-ui/button";
import { AnimatePresence } from "motion/react";
import { WorkspaceData } from "../App";

// Import các sub-component chuyên biệt đã được phân tách
import { StructuredQuestionsForm } from "./terminal/StructuredQuestionsForm";
import { TimelineTextBlock } from "./terminal/TimelineTextBlock";
import { CollapsibleSteps } from "./terminal/CollapsibleSteps";
import { ChatInputForm } from "./terminal/ChatInputForm";

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

interface WebTerminalProps {
  activeAgent: "MaxHermes" | "MaxClaw";
  activeModel: string;
  setActiveModel: (model: string) => void;
  sse: ReturnType<typeof useSSE>;
  workspaceData: WorkspaceData | null;
  onViewDiff?: (filePath: string) => void;
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

export function WebTerminal({ activeAgent, activeModel, setActiveModel, sse, workspaceData, onViewDiff }: WebTerminalProps) {
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
        chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
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
    let timeoutId: NodeJS.Timeout | null = null;

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

                  timeoutId = setTimeout(() => {
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

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isGenerating, messages, sendPrompt, setLogs, activeAgent, activeModel]);

  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages]);

  const handleSendMessage = useCallback((
    prompt: string,
    useReformulate: boolean,
    useHeadless: boolean,
    pastedImages: string[]
  ) => {
    shouldAutoScrollRef.current = true;
    sendPrompt(prompt, useReformulate, pastedImages, activeAgent, activeModel, useHeadless);
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
                <p className="text-xs font-semibold text-zinc-650">Chưa có hội thoại.</p>
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
                    className={`flex flex-col space-y-2 max-w-[85%] text-base ${msg.role === 'user' ? 'ml-auto' : 'mr-auto w-full'}`}
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

                    {msg.images && msg.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-1 justify-end max-w-full">
                        {msg.images.map((img, imgIdx) => (
                          <img
                            key={imgIdx}
                            src={img}
                            alt={`Uploaded visual data ${imgIdx}`}
                            className="max-h-48 rounded-lg border border-zinc-200 object-contain shadow-md bg-zinc-50 p-0.5"
                          />
                        ))}
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
                                onViewDiff={onViewDiff}
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
                } catch { }
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