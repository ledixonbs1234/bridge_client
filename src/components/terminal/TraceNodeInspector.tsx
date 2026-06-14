// filepath: bridge_client/src/components/terminal/TraceNodeInspector.tsx
import * as React from "react";
import { useMemo, useEffect, useRef } from "react";
import { Node } from "reactflow";
import { marked } from "marked";
import { StructuredQuestionsForm } from "./StructuredQuestionsForm";
import { TimelineTextBlock } from "./TimelineTextBlock";
import { RenderTimeline, mapLiveTimelineToAccumulator, GroupedTimelineEvent } from "./TimelineEvents";

interface TraceNodeInspectorProps {
    selectedNode: Node | null;
    setSelectedNode: (node: Node | null) => void;
    theme: "light" | "dark";
    onViewDiff?: (filePath: string) => void;
    pendingPermission: any;
    respondToPermission: (id: string, ans: string) => void;
}

export function TraceNodeInspector({
    selectedNode,
    setSelectedNode,
    theme,
    onViewDiff,
    pendingPermission,
    respondToPermission
}: TraceNodeInspectorProps) {
    const modalScrollRef = useRef<HTMLDivElement>(null);

    // 1. Hook useEffect: Luôn khai báo unconditionally ở trên cùng
    useEffect(() => {
        if (selectedNode && modalScrollRef.current) {
            const timer = setTimeout(() => {
                if (modalScrollRef.current) {
                    modalScrollRef.current.scrollTop = modalScrollRef.current.scrollHeight;
                }
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [selectedNode?.id, selectedNode?.data?.content]);

    // 2. Hook useMemo thứ nhất: Thêm kiểm tra an toàn selectedNode
    const parsedSummaryList = useMemo(() => {
        if (!selectedNode || !selectedNode.data?.content) return null;
        const content = selectedNode.data.content.trim();
        if (content.startsWith('[') && content.endsWith(']')) {
            try {
                return JSON.parse(content);
            } catch {
                return null;
            }
        }
        return null;
    }, [selectedNode]);

    // 3. Hook useMemo thứ hai: Thêm kiểm tra an toàn selectedNode
    const inspectorHtml = useMemo(() => {
        if (!selectedNode || !selectedNode.data?.content) return "";
        try {
            return marked.parse(selectedNode.data.content) as string;
        } catch {
            return selectedNode.data.content;
        }
    }, [selectedNode]);

    // CHỐT CHẶN: Chỉ đặt câu lệnh trả về sớm (conditional return) tại đây, SAU KHI tất cả Hooks đã khai báo xong
    if (!selectedNode) return null;

    const isDark = theme === "dark";

    return (
        <div
            className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 select-text transition-colors duration-200 ${isDark ? "bg-black/85" : "bg-zinc-900/60 backdrop-blur-xs"
                }`}
            onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedNode(null);
            }}
        >
            <div
                className={`border rounded-2xl w-full max-w-3xl h-[80vh] max-h-[85vh] overflow-hidden flex flex-col relative transition-all duration-200 ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-800 shadow-2xl"
                    }`}
                style={{
                    animation: "zoomIn 0.2s ease-out",
                    boxShadow: isDark ? "0 0 30px rgba(0, 240, 255, 0.1)" : undefined
                }}
            >
                <div className={`px-6 py-4 flex justify-between items-center select-none shrink-0 transition-colors duration-200 ${isDark ? "bg-zinc-900 border-b border-zinc-800" : "bg-zinc-50 border-b border-zinc-200"
                    }`}>
                    <div className="text-left">
                        <h3 className={`text-xs font-bold uppercase tracking-widest font-mono ${isDark ? "text-cyan-400" : "text-cyan-600"
                            }`}>
                            🤖 trace node inspector
                        </h3>
                        <p className={`text-[10px] font-mono mt-0.5 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                            Node ID: {selectedNode.id}
                        </p>
                    </div>
                    <button
                        onClick={() => setSelectedNode(null)}
                        className={`px-3.5 py-1.5 border rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${isDark
                            ? "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white"
                            : "bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-900"
                            }`}
                    >
                        CLOSE [Esc]
                    </button>
                </div>

                {/* Container cuộn chính - Đã liên kết ref để auto-scroll */}
                <div
                    ref={modalScrollRef}
                    className={`flex-1 overflow-auto p-6 space-y-5 text-left transition-colors duration-200 ${isDark ? "bg-[#020204]" : "bg-white"
                        }`}
                >
                    <div className={`flex justify-between items-start flex-wrap gap-2 border-b pb-4 ${isDark ? "border-zinc-900" : "border-zinc-100"
                        }`}>
                        <div>
                            <h4 className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider mb-0.5">Node Type</h4>
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"
                                }`}>
                                {selectedNode.type}
                            </span>
                        </div>
                        {selectedNode.data.state && (
                            <div>
                                <h4 className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider mb-0.5">State</h4>
                                <span className="text-xs font-mono font-bold text-emerald-500">{selectedNode.data.state.toUpperCase()}</span>
                            </div>
                        )}
                    </div>

                    {selectedNode.type === "cyberUser" && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <div className={`text-xs font-bold select-none font-mono ${isDark ? "text-cyan-500" : "text-cyan-600"}`}>💬 PROMPT CONTENT:</div>
                                <div className={`p-4 border rounded-xl transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                                    }`}>
                                    <TimelineTextBlock content={selectedNode.data.content} theme={theme} />
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedNode.type === "cyberAgent" && (
                        <div className="space-y-4">
                            <div className={`grid grid-cols-2 gap-4 text-xs font-mono transition-colors ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                                <div>• Name: <span className="font-bold" style={{ color: isDark ? "#fff" : "#18181b" }}>{selectedNode.data.name}</span></div>
                                <div>• Model: <span className="font-bold" style={{ color: isDark ? "#60a5fa" : "#2563eb" }}>{selectedNode.data.model}</span></div>
                            </div>
                            {selectedNode.data.content && (
                                <div className="space-y-4">
                                    {parsedSummaryList && Array.isArray(parsedSummaryList) ? (
                                        <div className="space-y-6 divide-y divide-zinc-200/40 dark:divide-zinc-800/40">
                                            {parsedSummaryList.map((turn: any, tIdx: number) => {
                                                const timelineEvents: GroupedTimelineEvent[] = [];
                                                const toolCallMap = new Map<string, GroupedTimelineEvent>();

                                                if (Array.isArray(turn.accumulator)) {
                                                    turn.accumulator.forEach((evt: any) => {
                                                        if (evt.type === "action") {
                                                            const groupEvt: GroupedTimelineEvent = {
                                                                id: evt.step_id || `tool-${Math.random()}`,
                                                                type: "tool_call",
                                                                tool: evt.tool,
                                                                args: evt.args,
                                                                hasOutput: false
                                                            };
                                                            timelineEvents.push(groupEvt);
                                                            if (evt.step_id) toolCallMap.set(evt.step_id, groupEvt);
                                                        } else if (evt.type === "tool_output") {
                                                            const existing = evt.step_id ? toolCallMap.get(evt.step_id) : null;
                                                            if (existing) {
                                                                existing.output = evt.output;
                                                                existing.hasOutput = true;
                                                            }
                                                        } else {
                                                            const typeMapping: "log" | "system" | "chunk" =
                                                                (evt.type === "log" || evt.type === "system" || evt.type === "chunk") ? evt.type : "log";
                                                            timelineEvents.push({
                                                                id: `evt-${Math.random()}`,
                                                                type: typeMapping,
                                                                content: evt.content,
                                                                hasOutput: false
                                                            });
                                                        }
                                                    });
                                                }

                                                return (
                                                    <div key={tIdx} className={`space-y-3.5 ${tIdx > 0 ? "pt-6" : ""}`}>
                                                        <div className="space-y-1">
                                                            <div className={`text-[10px] font-bold font-mono tracking-wider ${isDark ? "text-cyan-400" : "text-cyan-600"}`}>💬 USER PROMPT:</div>
                                                            <div className={`p-3 rounded-xl border text-[13px] leading-relaxed font-sans whitespace-pre-wrap ${isDark ? "bg-zinc-900/60 border-zinc-800/80 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-700"
                                                                }`}>
                                                                {turn.query}
                                                            </div>
                                                        </div>
                                                        {timelineEvents.length > 0 && (
                                                            <div className="space-y-2">
                                                                <div className={`text-[10px] font-bold font-mono tracking-wider ${isDark ? "text-amber-500" : "text-amber-600"}`}>🧠 INTERACTIVE TIMELINE:</div>
                                                                <RenderTimeline events={timelineEvents} theme={theme} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            <div className={`text-xs font-bold select-none font-mono ${isDark ? "text-amber-500" : "text-amber-600"}`}>🧠 THOUGHT PROCESS:</div>
                                            <div className={`p-4 border rounded-xl transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                                                }`}>
                                                <div
                                                    className={`text-[14px] leading-relaxed select-text ${isDark ? "markdown-body-dark" : "markdown-body"}`}
                                                    dangerouslySetInnerHTML={{ __html: inspectorHtml }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {selectedNode.type === "cyberTool" && (
                        <div className="space-y-4">
                            <div className={`grid grid-cols-2 gap-4 text-xs font-mono transition-colors ${isDark ? "text-zinc-400" : "text-zinc-655"}`}>
                                <div>• Tool: <span className="font-bold text-orange-500">{selectedNode.data.tool}</span></div>
                                <div>• Description: <span className="font-semibold">{selectedNode.data.title}</span></div>
                            </div>
                            {selectedNode.data.input && (
                                <div className="space-y-1.5 pt-3 border-t">
                                    <div className="text-xs font-bold select-none font-mono text-orange-500">⚙️ INPUT ARGUMENTS:</div>
                                    <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ${isDark ? "bg-zinc-900 border-zinc-800 text-blue-400" : "bg-zinc-50 border-zinc-200 text-blue-600"
                                        }`}>
                                        {selectedNode.data.input}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}