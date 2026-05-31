import React, { useState, useRef, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import { Button } from './animate-ui/button';
import { motion } from 'motion/react';
import { marked } from 'marked';
import { MermaidRenderer } from './MermaidRenderer';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Switch({ checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 ${checked ? "bg-blue-600" : "bg-zinc-700"
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

// Bộ phân giải bóc tách markdown và khối Mermaid
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

export function WebTerminal() {
  const [input, setInput] = useState('');
  const [useReformulate, setUseReformulate] = useState(true);
  const [pastedImage, setPastedImage] = useState<string | null>(null);

  const { messages, logs, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration, setLogs } = useSSE();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const lastValidatedMessageRef = useRef<string | null>(null);
  const fixAttemptsRef = useRef<number>(0);

  // Bộ giám sát và tự động bắt lỗi cú pháp Mermaid gửi về cho AI sửa
  useEffect(() => {
    if (!isGenerating && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant' && lastMsg.content !== lastValidatedMessageRef.current) {
        lastValidatedMessageRef.current = lastMsg.content;

        // Trích xuất các sơ đồ Mermaid có trong tin nhắn
        const regex = /```mermaid\n([\s\S]*?)```/g;
        const blocks: string[] = [];
        let match;
        while ((match = regex.exec(lastMsg.content)) !== null) {
          blocks.push(match[1]);
        }

        if (blocks.length > 0) {
          const validateAll = async () => {
            // Lazy import mermaid để chạy parser kiểm thử
            const { default: mermaidInst } = await import('mermaid');
            
            for (let i = 0; i < blocks.length; i++) {
              const block = blocks[i];
              try {
                await mermaidInst.parse(block);
              } catch (err: any) {
                console.warn("Phát hiện cú pháp Mermaid lỗi:", err);
                const errMsg = err.message || String(err);
                
                // Giới hạn tối đa 2 lần thử sửa tự động cho cùng 1 bối cảnh để tránh lặp vô hạn
                if (fixAttemptsRef.current < 2) {
                  fixAttemptsRef.current += 1;
                  
                  setLogs((prev) => [...prev, {
                    timestamp: new Date().toLocaleTimeString(),
                    text: `⚠️ Phát hiện lỗi cú pháp Mermaid. Đang gửi báo cáo tự sửa lỗi (lần ${fixAttemptsRef.current}/2)...`,
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
                    sendPrompt(systemFeedback, false); // Gửi trực tiếp mà không cần qua Reformulator
                  }, 1500);
                }
                break; 
              }
            }
          };
          validateAll();
        } else {
          // Reset số lần đếm nếu không phát hiện lỗi gì
          fixAttemptsRef.current = 0;
        }
      }
    }
  }, [isGenerating, messages, sendPrompt, setLogs]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pastedImage) || isGenerating) return;

    sendPrompt(input, useReformulate, pastedImage);
    setInput('');
    setPastedImage(null);
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
    <div className="grid grid-cols-1 lg:grid-cols-[460px_1fr] gap-6 h-[720px] max-h-[80vh]">
      {/* CỘT TRÁI: CHAT PANEL */}
      <div className="flex flex-col bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-xl p-5 overflow-hidden relative shadow-md">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-500 py-20 text-center">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-xs">Chưa có hội thoại. Hãy bắt đầu một câu hỏi để tương tác với Agent.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-xl max-w-[85%] text-left text-sm transition-all ${msg.role === 'user'
                    ? 'bg-blue-600 text-white ml-auto shadow-sm'
                    : 'bg-zinc-800/60 border border-zinc-700/40 text-zinc-100 shadow-sm'
                  }`}
              >
                {msg.image && (
                  <div className="mb-2">
                    <img 
                      src={msg.image} 
                      alt="Uploaded visual representation" 
                      className="max-h-48 rounded-lg border border-zinc-700/60 object-contain shadow-sm bg-zinc-950/20 p-0.5"
                    />
                  </div>
                )}

                {(() => {
                  const cleanContent = msg.content
                    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
                    .trim();

                  const parts = parseContentAndMermaid(cleanContent);

                  return (
                    <div className="space-y-3">
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
                            className="markdown-body text-left leading-relaxed text-sm select-text"
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* HỘP THOẠI PHÊ DUYỆT */}
        {pendingPermission && (
          <div className="mt-4 p-4 bg-zinc-950/80 border border-amber-500/30 rounded-xl space-y-3 shadow-lg animate-pulse text-left">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
              <span>⚠️</span> YÊU CẦU PHÊ DUYỆT WORKFLOW
            </div>
            <p className="text-xs text-zinc-200 leading-relaxed font-medium">
              {pendingPermission.query}
            </p>
            {pendingPermission.details && (
              <pre className="p-2.5 bg-zinc-900 text-[10px] text-zinc-500 font-mono rounded overflow-auto max-h-24 whitespace-pre-wrap">
                {pendingPermission.details}
              </pre>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                className="text-red-400 border-red-500/20 hover:bg-red-950/20 text-[10px] h-8 px-2.5"
                onClick={() => respondToPermission(pendingPermission.id, 'n')}
              >
                Từ chối
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-blue-400 border-blue-500/20 hover:bg-blue-950/20 text-[10px] h-8 px-2.5"
                onClick={() => respondToPermission(pendingPermission.id, 'y')}
              >
                Đồng ý (Yes)
              </Button>
              <Button
                variant="default"
                size="sm"
                className="text-[10px] h-8 px-2.5 bg-blue-600 hover:bg-blue-700"
                onClick={() => respondToPermission(pendingPermission.id, 'a')}
              >
                Đồng ý tất cả
              </Button>
            </div>
          </div>
        )}

        {/* INPUT & SETTING BOX */}
        <form onSubmit={handleSubmit} className="mt-4 border-t border-zinc-800/80 pt-4 bg-transparent">
          <div className="flex items-center gap-3 mb-4 select-none">
            <Switch checked={useReformulate} onChange={setUseReformulate} />
            <span className="text-xs font-medium text-zinc-400">
              Tối ưu câu hỏi (Reformulate)
            </span>
          </div>

          {pastedImage && (
            <div className="relative inline-block mb-3 group animate-fade-in">
              <img
                src={pastedImage}
                alt="Pasted Thumbnail"
                className="max-h-24 max-w-[200px] rounded-lg border border-zinc-700 shadow-md object-contain bg-zinc-950/40 p-1"
              />
              <button
                type="button"
                onClick={() => setPastedImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shadow-md transition-all cursor-pointer"
                title="Xóa hình ảnh"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex gap-2.5 items-end bg-zinc-950/60 border border-zinc-800 rounded-lg p-2 focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-700 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              placeholder="Code your creativity here..."
              rows={2}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-zinc-100 placeholder-zinc-500 p-1 leading-relaxed"
            />
            <Button
              type="submit"
              variant={isGenerating ? "destructive" : "default"}
              onClick={isGenerating ? stopGeneration : undefined}
              className="h-9 px-4 rounded-md font-semibold text-xs"
            >
              {isGenerating ? 'Dừng' : 'Gửi'}
            </Button>
          </div>
        </form>
      </div>

      {/* CỘT PHẢI: LOG STREAM PANEL */}
      <div className="bg-zinc-950/40 backdrop-blur-md border border-zinc-800/80 rounded-xl p-5 flex flex-col overflow-hidden shadow-md">
        <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3 mb-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Live Execution Logs</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-500">
            Realtime Stream
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2.5 font-mono text-[11px] text-zinc-300 pr-2 scrollbar-thin text-left">
          {logs.length === 0 ? (
            <div className="text-zinc-600 text-center py-40">Chờ lệnh thực thi từ Agent...</div>
          ) : (
            logs.map((log, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border leading-relaxed ${log.type === 'tool-call'
                    ? 'bg-blue-950/10 border-blue-900/30 text-blue-300'
                    : log.type === 'tool-output'
                      ? 'bg-emerald-950/10 border-emerald-900/30 text-emerald-300'
                      : log.type === 'error'
                        ? 'bg-red-950/10 border-red-900/30 text-red-400'
                        : 'bg-zinc-900/30 border-zinc-850 text-zinc-400'
                  }`}
              >
                <span className="text-zinc-600 mr-2">[{log.timestamp}]</span>
                <span className="whitespace-pre-wrap">{log.text}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}