// filepath: ridge_client/src/components/terminal/TimelineEvents.tsx
import * as React from "react";
import { useState, useMemo } from "react";
import { TimelineTextBlock } from "./TimelineTextBlock";

export interface GroupedTimelineEvent {
    id: string;
    type: 'log' | 'system' | 'chunk' | 'tool_call';
    timestamp?: string;
    content?: string;
    tool?: string;
    args?: any;
    output?: any;
    hasOutput: boolean;
}

// Hàm hỗ trợ thu gọn dữ liệu string quá dài để tránh tràn giao diện [5]
function simplifyArgs(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(simplifyArgs);
    const simplified: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
            if (v.length > 120) {
                simplified[k] = v.substring(0, 120) + "... [Dữ liệu lớn đã được thu gọn]";
            } else {
                simplified[k] = v;
            }
        } else if (typeof v === 'object') {
            simplified[k] = simplifyArgs(v);
        } else {
            simplified[k] = v;
        }
    }
    return simplified;
}

export function mapLiveTimelineToAccumulator(timeline: any[]) {
    const accumulator: any[] = [];
    if (!timeline || !Array.isArray(timeline)) return accumulator;

    timeline.forEach(item => {
        if (item.type === 'text' && item.content) {
            accumulator.push({
                type: 'chunk',
                content: item.content
            });
        } else if (item.type === 'steps' && item.steps) {
            item.steps.forEach((step: any) => {
                if (step.type === 'thinking') {
                    accumulator.push({
                        type: 'log',
                        content: step.input
                    });
                } else {
                    let parsedArgs = {};
                    if (step.input) {
                        try {
                            const trimmed = step.input.trim();
                            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                                parsedArgs = JSON.parse(trimmed);
                            } else {
                                parsedArgs = { "arguments": step.input };
                            }
                        } catch {
                            parsedArgs = { "arguments": step.input };
                        }
                    }

                    accumulator.push({
                        type: 'action',
                        tool: step.toolName || step.title,
                        args: parsedArgs,
                        step_id: step.id
                    });

                    if (step.output) {
                        accumulator.push({
                            type: 'tool_output',
                            step_id: step.id,
                            output: step.output
                        });
                    }
                }
            });
        }
    });

    return accumulator;
}

export function CollapsibleToolCall({ event, theme }: { event: any; theme: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const isDark = theme === 'dark';

    // Tạo danh sách cặp tham số hiển thị ở tiêu đề ngoài, tự động thu gọn các chuỗi quá dài
    const argsPairs = useMemo(() => {
        if (!event.args || typeof event.args !== 'object') return [];
        return Object.entries(event.args).map(([k, v]) => {
            let displayVal = "";
            if (typeof v === 'object') {
                displayVal = JSON.stringify(simplifyArgs(v));
            } else {
                displayVal = String(v);
            }
            if (displayVal.length > 80) {
                displayVal = displayVal.substring(0, 80) + "... [Đã thu gọn]";
            }
            return { key: k, value: displayVal };
        });
    }, [event.args]);

    // Thu gọn tham số đầy đủ hiển thị trong bảng chi tiết
    const simplifiedFullArgs = useMemo(() => {
        return simplifyArgs(event.args || {});
    }, [event.args]);

    const displayOutput = useMemo(() => {
        if (!event.output) return '';
        if (typeof event.output === 'object') {
            if (event.output.status === 'success' && event.output.data) {
                return typeof event.output.data === 'object'
                    ? JSON.stringify(event.output.data, null, 2)
                    : String(event.output.data);
            }
            return JSON.stringify(event.output, null, 2);
        }
        return String(event.output);
    }, [event.output]);

    return (
        <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${isDark ? 'bg-zinc-900/40 border-zinc-800' : 'bg-zinc-50 border-zinc-200 shadow-xs'
            }`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors cursor-pointer ${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-100/50'
                    }`}
            >
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-base select-none">🛠️</span>
                        <span className={`text-[11px] font-bold font-mono ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>
                            Gọi Tool: {event.tool}
                        </span>
                    </div>
                    {argsPairs.length > 0 && (
                        <div className="pl-6 space-y-0.5 text-[10px] font-mono opacity-80 leading-normal">
                            {argsPairs.map((p: any) => (
                                <div key={p.key}>
                                    <span className="text-zinc-400">{p.key}</span>
                                    <span className="mx-1 text-zinc-500">→</span>
                                    <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>{p.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 select-none">
                    <span className="text-[10px] font-bold font-mono text-zinc-450 hover:text-zinc-500">
                        {isOpen ? 'Thu gọn [-]' : 'Chi tiết [+]'}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className={`p-4 border-t space-y-3 text-[11px] font-mono leading-relaxed select-text ${isDark ? 'border-zinc-850 bg-zinc-950/60 text-zinc-300' : 'border-zinc-200 bg-white text-zinc-700'
                    }`}>
                    <div className="space-y-1">
                        <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider select-none">Tham số đầy đủ:</div>
                        <pre className={`p-2.5 rounded border max-h-40 overflow-y-auto ${isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                            }`}>
                            {JSON.stringify(simplifiedFullArgs, null, 2)}
                        </pre>
                    </div>

                    {event.hasOutput && (
                        <div className="space-y-1">
                            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider select-none">Kết quả trả về:</div>
                            <pre className={`p-2.5 rounded border max-h-60 overflow-y-auto ${isDark ? 'bg-zinc-900 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-emerald-850'
                                }`}>
                                {displayOutput}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function RenderTimeline({ events, theme, isGenerating = false }: { events: GroupedTimelineEvent[]; theme: string; isGenerating?: boolean }) {
    const isDark = theme === 'dark';

    // Lọc bỏ động các log (thinking) đã hoàn thành:
    // Chỉ hiển thị log nếu nó ở vị trí cuối cùng trong mảng sự kiện và hệ thống đang actively tạo phản hồi [5]
    const visibleEvents = useMemo(() => {
        return events.filter((evt, index) => {
            if (evt.type === 'log') {
                const isLast = index === events.length - 1;
                return isGenerating && isLast;
            }
            return true;
        });
    }, [events, isGenerating]);

    return (
        <div className="relative pl-6 space-y-6 text-left">
            <div className={`absolute top-2 bottom-2 left-2.5 w-0.5 border-l-2 border-dashed ${isDark ? 'border-zinc-800' : 'border-zinc-200'
                }`} />

            {visibleEvents.map((evt) => {
                let icon = '🟢';
                let bgClass = isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-100 border-zinc-200';
                if (evt.type === 'log') icon = '🧠';
                else if (evt.type === 'system') icon = 'ℹ️';
                else if (evt.type === 'chunk') icon = '🤖';
                else if (evt.type === 'tool_call') icon = '🛠️';

                return (
                    <div key={evt.id} className="relative">
                        <div className={`absolute -left-[23px] top-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs select-none shadow-sm border ${bgClass}`}>
                            {icon}
                        </div>

                        <div className="space-y-1">
                            {evt.type === 'log' && (
                                <div className={`text-xs italic font-mono pl-1 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                    <span className="font-bold text-amber-500 animate-pulse">🧠 [AI] Đang suy nghĩ...</span>
                                    {evt.content && <div className="mt-1 opacity-80 whitespace-pre-wrap">{evt.content}</div>}
                                </div>
                            )}

                            {evt.type === 'system' && (
                                <div className={`text-xs font-bold pl-1 font-mono ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                    {evt.content}
                                </div>
                            )}

                            {evt.type === 'chunk' && (
                                <div className={`p-4 border rounded-xl select-text ${isDark ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50/50 border-zinc-200'}`}>
                                    <TimelineTextBlock content={evt.content || ''} theme={theme as 'light' | 'dark'} />
                                </div>
                            )}

                            {evt.type === 'tool_call' && (
                                <CollapsibleToolCall event={evt} theme={theme} />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}