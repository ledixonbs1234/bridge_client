// filepath: bridge_client/src/components/terminal/VisualFlow.tsx
import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    useNodesState,
    useEdgesState,
    MarkerType,
    ReactFlowProvider,
    useReactFlow
} from "reactflow";
import "reactflow/dist/style.css";
import { useSSE } from "../../hooks/useSSE";
import { ChatInputForm } from "./ChatInputForm";
import { WorkspaceData } from "../../App";
import { AiOutputPanel } from "./AiOutputPanel";
import { TraceNodeInspector } from "./TraceNodeInspector";
import { mapLiveTimelineToAccumulator } from "./TimelineEvents";

// Nhập khẩu các custom nodes chất lượng cao
import {
    CyberGroupNode,
    CyberUserNode,
    CyberAgentNode,
    CyberToolNode,
    CyberValidatorNode
} from "../nodes";

const nodeTypes = {
    cyberUser: CyberUserNode,
    cyberAgent: CyberAgentNode,
    cyberTool: CyberToolNode,
    cyberValidator: CyberValidatorNode,
    cyberGroup: CyberGroupNode
};

interface VisualFlowProps {
    activeAgent: "MaxHermes" | "MaxClaw";
    activeModel: string;
    setActiveModel: (model: string) => void;
    sse: ReturnType<typeof useSSE>;
    workspaceData: WorkspaceData | null;
    onViewDiff?: (filePath: string) => void;
    theme: "light" | "dark";
    setTheme: React.Dispatch<React.SetStateAction<"light" | "dark">>;
    fetchWorkspace: () => void;
}

export function VisualFlow(props: VisualFlowProps) {
    return (
        <ReactFlowProvider>
            <VisualFlowInner {...props} />
        </ReactFlowProvider>
    );
}

function VisualFlowInner({
    activeAgent,
    activeModel,
    setActiveModel,
    sse,
    workspaceData,
    onViewDiff,
    theme,
    setTheme,
    fetchWorkspace
}: VisualFlowProps) {
    const { messages, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration } = sse;

    const [realProviders, setRealProviders] = useState<any[]>([]);
    const [availableCommands, setAvailableCommands] = useState<any[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const { fitView } = useReactFlow();
    const toggleBtnRef = useRef<HTMLButtonElement>(null);
    const lastContentRef = useRef<string>("");

    // Lưu trữ trạng thái Pin của Panel (mặc định false)
    const [isPinned, setIsPinned] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem("bridge_panel_pinned");
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    useEffect(() => {
        localStorage.setItem("bridge_panel_pinned", JSON.stringify(isPinned));
    }, [isPinned]);

    // Trạng thái nhấp nháy (Blinking) của nút gọi Panel
    const [isBlinking, setIsBlinking] = useState(false);

    const [panelWidth, setPanelWidth] = useState<number>(() => {
        try {
            const saved = localStorage.getItem("bridge_response_panel_width");
            return saved ? parseInt(saved, 10) : 420;
        } catch {
            return 420;
        }
    });

    const [panelHeight, setPanelHeight] = useState<number>(() => {
        try {
            const saved = localStorage.getItem("bridge_response_panel_height");
            return saved ? parseInt(saved, 10) : 350;
        } catch {
            return 350;
        }
    });

    const [showResponsePanel, setShowResponsePanel] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem("bridge_show_response_panel");
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        localStorage.setItem("bridge_response_panel_width", String(panelWidth));
        localStorage.setItem("bridge_response_panel_height", String(panelHeight));
        localStorage.setItem("bridge_show_response_panel", JSON.stringify(showResponsePanel));
    }, [panelWidth, panelHeight, showResponsePanel]);

    useEffect(() => {
        fetch("/api/provider/config")
            .then((res) => res.json())
            .then((data) => {
                if (data?.providers) {
                    const list = Object.entries(data.providers)
                        .filter(([_, p]: any) => p.enabled)
                        .map(([key, p]: any) => ({ key, name: p.name || key }));
                    setRealProviders(list);
                }
            });

        fetch("/api/dashboard/commands")
            .then((res) => res.json())
            .then((data) => {
                if (data.cli) setAvailableCommands(data.cli);
            });
    }, []);

    const lastAssistantMessage = useMemo(() => {
        return [...messages].reverse().find(m => m.role === "assistant");
    }, [messages]);

    // GIÁM SÁT THÔNG TIN MỚI: Chỉ nhấp nháy lại khi phát hiện có nội dung mới đang stream và Panel đang ĐÓNG
    useEffect(() => {
        const currentContent = lastAssistantMessage?.content || "";

        if (currentContent !== lastContentRef.current) {
            if (!showResponsePanel && currentContent.length > 0) {
                setIsBlinking(true);
            }
            lastContentRef.current = currentContent;
        }
    }, [lastAssistantMessage?.content, showResponsePanel]);

    // Hàm kiểm soát click Toggle: Nhấp chuột vào nút sẽ lập tức gỡ bỏ hoàn toàn trạng thái nhấp nháy
    const handleToggleResponsePanel = () => {
        setShowResponsePanel(prev => !prev);
        setIsBlinking(false);
    };

    const handleSwitchProvider = (providerKey: string, modelName: string) => {
        fetch("/api/provider/switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: providerKey, model: modelName })
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setActiveModel(modelName);
                    fetchWorkspace();
                }
            })
            .catch((err) => console.error("Lỗi chuyển đổi provider:", err));
    };

    // ĐỒNG BỘ ĐỒ THỊ KHI ĐANG CHẠY THỜI GIAN THỰC
    useEffect(() => {
        if (!workspaceData) return;

        const nodesList: any[] = [];
        const edgesList: any[] = [];

        const currentStepMap = workspaceData.states || [];
        const runningStepKey = workspaceData.activeTask?.step_key || "";
        const harnessNodesConfig = workspaceData.harness_config?.nodes || {};
        const initialNode = workspaceData.harness_config?.initial_node || "planner";

        const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
        const userNodeId = "user-prompt-node";
        if (lastUserMsg) {
            nodesList.push({
                id: userNodeId,
                type: "cyberUser",
                data: {
                    content: lastUserMsg.content,
                    images: lastUserMsg.images,
                    theme
                },
                position: { x: 50, y: 120 }
            });
        }

        const activeNodeName = runningStepKey ||
            currentStepMap.find(s => s.state === "RUNNING")?.step_key ||
            currentStepMap.find(s => s.state === "PENDING")?.step_key ||
            initialNode;

        Object.entries(harnessNodesConfig).forEach(([nodeName, nodeVal]: [string, any], idx) => {
            const dbState = currentStepMap.find(s => s.step_key === nodeName);
            let stateString = "idle";

            if (dbState) {
                if (dbState.state === "RUNNING") stateString = "running";
                else if (dbState.state === "VALIDATING") stateString = "thinking";
                else if (dbState.state === "DONE") stateString = "completed";
                else if (dbState.state === "FAILED" || dbState.state === "BLOCKED") stateString = "failed";
            }

            const isValidator = nodeVal.type === "validator";
            let content = dbState ? dbState.summary : "";

            if (nodeName === activeNodeName && messages.length > 0) {
                const turns: any[] = [];
                let tempUserContent = "";

                messages.forEach((msg, idxIdx) => {
                    if (msg.role === "user") {
                        tempUserContent = msg.content;
                    } else if (msg.role === "assistant") {
                        const timeline = msg.timeline || (msg.steps && msg.steps.length > 0 ? [{ id: `rec-${idxIdx}`, type: "steps", steps: msg.steps }] : []);
                        const accum = mapLiveTimelineToAccumulator(timeline);
                        turns.push({
                            query: tempUserContent || "(Không có prompt)",
                            accumulator: accum
                        });
                    }
                });

                if (messages[messages.length - 1]?.role === "user") {
                    turns.push({
                        query: messages[messages.length - 1].content,
                        accumulator: []
                    });
                }

                content = JSON.stringify(turns);
            }

            const activeAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
            const activeUsage = activeAssistantMsg?.usage || null;

            nodesList.push({
                id: nodeName,
                type: isValidator ? "cyberValidator" : "cyberAgent",
                data: {
                    theme,
                    name: nodeName.toUpperCase(),
                    role: isValidator ? "Strict Quality Gate" : "Specialist Worker Node",
                    model: workspaceData.provider.model || "Local Engine",
                    state: stateString,
                    content: content,
                    usage: nodeName === activeNodeName ? (activeUsage || undefined) : undefined
                },
                position: {
                    x: lastUserMsg ? 100 + idx * 320 + 300 : 100 + idx * 320,
                    y: 120
                }
            });
        });

        if (lastUserMsg) {
            edgesList.push({
                id: `edge-user-to-entry`,
                source: userNodeId,
                target: initialNode,
                type: "smoothstep",
                animated: runningStepKey === initialNode,
                style: {
                    stroke: theme === "dark" ? "#00f0ff" : "#0ea5e9",
                    strokeWidth: 2
                }
            });
        }

        Object.entries(harnessNodesConfig).forEach(([nodeName, nodeVal]: [string, any]) => {
            const addEdgeHelper = (targetNodeName: string) => {
                edgesList.push({
                    id: `edge-flow-${nodeName}-${targetNodeName}`,
                    source: nodeName,
                    target: targetNodeName,
                    type: "smoothstep",
                    style: {
                        stroke: theme === "dark" ? "#27272a" : "#d4d4d8",
                        strokeWidth: 1.5
                    },
                    markerEnd: { type: MarkerType.ArrowClosed }
                });
            };
            if (nodeVal.next) addEdgeHelper(nodeVal.next);
        });

        setNodes(nodesList);
        setEdges(edgesList);

    }, [messages, isGenerating, workspaceData, setNodes, setEdges, theme]);

    // Tự động căn chỉnh tối ưu toàn màn hình (fitView) khi có thay đổi cấu trúc sơ đồ
    const nodeStructureKey = useMemo(() => {
        return `${nodes.length}-${nodes.map(n => `${n.id}:${n.position.x}:${n.position.y}`).join(",")}`;
    }, [nodes]);

    useEffect(() => {
        if (nodes.length > 0) {
            const timer = setTimeout(() => {
                fitView({ padding: 0.2, duration: 800 });
            }, 180);
            return () => clearTimeout(timer);
        }
    }, [nodeStructureKey, fitView]);

    // Lắng nghe sự thay đổi của danh sách nodes động để liên tục cập nhật dữ liệu real-time lên modal inspector
    const activeSelectedNode = useMemo(() => {
        if (!selectedNode) return null;
        return nodes.find((n) => n.id === selectedNode.id) || selectedNode;
    }, [nodes, selectedNode]);

    const isDark = theme === "dark";

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden relative select-none transition-colors duration-200 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-100 text-zinc-800"
            }`} style={{ height: "100%", minHeight: "500px" }}>

            <div className="flex-1 h-full w-full relative" style={{ height: "100%" }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, node) => setSelectedNode(node)}
                    className={isDark ? "bg-[#05050c]" : "bg-[#f4f4f5]"}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color={isDark ? "#312e81" : "#cbd5e1"} gap={16} size={1} />
                    <Controls className={isDark ? "bg-zinc-900 border border-zinc-800 text-zinc-100" : "bg-white border border-zinc-200 text-zinc-800"} />
                    <MiniMap
                        nodeStrokeColor={(n) => (n.type === "cyberUser" ? (isDark ? "#00f0ff" : "#0ea5e9") : (isDark ? "#ff5e00" : "#ea580c"))}
                        nodeColor={(n) => (n.type === "cyberUser" ? (isDark ? "#00f0ff33" : "#0ea5e933") : (isDark ? "#ff5e0033" : "#ea580c33"))}
                        className={isDark ? "bg-zinc-900/90 border border-zinc-800" : "bg-white/90 border border-zinc-200"}
                        maskColor={isDark ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)"}
                    />
                </ReactFlow>

                {/* Left Floating Action Menu */}
                <div className="absolute top-4 left-4 z-40 flex gap-2 pointer-events-auto select-none">
                    <button
                        type="button"
                        onClick={() => setTheme(prev => (prev === "light" ? "dark" : "light"))}
                        className={`border rounded-lg p-2 text-xs font-bold cursor-pointer shadow-lg flex items-center gap-1.5 transition-all duration-200 ${isDark
                            ? "bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                            : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                            }`}
                        title="Chuyển đổi giao diện Sáng / Tối"
                    >
                        <span>{isDark ? "☀️" : "🌙"}</span> {isDark ? "Sáng" : "Tối"}
                    </button>
                </div>

                {/* Right Toggle Button: AI Output Panel */}
                {lastAssistantMessage && (
                    <div className="absolute top-4 right-4 z-40 flex flex-col items-end pointer-events-none select-none">
                        <button
                            ref={toggleBtnRef}
                            type="button"
                            onClick={handleToggleResponsePanel}
                            className={`border text-xs font-semibold cursor-pointer shadow-lg flex items-center gap-1.5 pointer-events-auto rounded-lg p-2 transition-all duration-300 ${isBlinking
                                ? "bg-cyan-500 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)] animate-pulse font-bold"
                                : isDark
                                    ? "bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:text-white"
                                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                                }`}
                        >
                            <span>{showResponsePanel ? "👉" : "👈"}</span>
                            AI Output Panel
                            {isBlinking && <span className="w-2 h-2 rounded-full bg-white animate-ping ml-1" />}
                        </button>

                        {/* RENDER MODULAR AI OUTPUT PANEL */}
                        <AiOutputPanel
                            lastAssistantMessage={lastAssistantMessage}
                            showResponsePanel={showResponsePanel}
                            setShowResponsePanel={setShowResponsePanel}
                            panelWidth={panelWidth}
                            panelHeight={panelHeight}
                            setPanelWidth={setPanelWidth}
                            setPanelHeight={setPanelHeight}
                            isPinned={isPinned}
                            setIsPinned={setIsPinned}
                            theme={theme}
                            toggleBtnRef={toggleBtnRef}
                        />
                    </div>
                )}

                {/* Bottom Input Field */}
                <div className="absolute bottom-4 left-4 right-4 z-50 max-w-4xl mx-auto select-none pointer-events-auto">
                    <ChatInputForm
                        activeAgent={activeAgent}
                        currentActiveModelName={activeModel}
                        realProviders={realProviders}
                        handleSwitchProvider={handleSwitchProvider}
                        isGenerating={isGenerating}
                        stopGeneration={stopGeneration}
                        availableCommands={availableCommands}
                        onSendMessage={(prompt, useRefMode, useHeadless, images, mode, selectedModel) => {
                            setSelectedNode(null);
                            sendPrompt(prompt, useRefMode, images, activeAgent, selectedModel || activeModel, useHeadless, mode);
                        }}
                    />
                </div>
            </div>

            {/* Structured HITL Approval Overlay */}
            {pendingPermission && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs select-text">
                    <div className="bg-zinc-900 border border-amber-500 rounded-2xl p-6 space-y-4 shadow-2xl text-left max-w-md w-full relative" style={{ animation: "zoomIn 0.18s ease-out" }}>
                        <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[11px] font-mono select-none">
                            <span className="animate-pulse">⚠️</span> hitl approval required
                        </div>
                        <p className="text-xs text-zinc-200 leading-relaxed font-semibold">
                            {pendingPermission.query}
                        </p>
                        <div className="flex gap-1.5 justify-end pt-1">
                            <button
                                onClick={() => respondToPermission(pendingPermission.id, "n")}
                                className="px-3.5 py-1.5 border border-red-500 bg-red-950/20 text-red-500 rounded-lg text-[10px] font-mono font-bold hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                                DENY
                            </button>
                            <button
                                onClick={() => respondToPermission(pendingPermission.id, "y")}
                                className="px-3.5 py-1.5 border border-blue-500 bg-blue-950/20 text-blue-400 rounded-lg text-[10px] font-mono font-bold hover:bg-blue-50/20 transition-all cursor-pointer"
                            >
                                APPROVE
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RENDER MODULAR TRACE INSPECTOR MODAL */}
            <TraceNodeInspector
                selectedNode={activeSelectedNode} // Đã sửa đổi: Đồng bộ sang activeSelectedNode để hỗ trợ streaming
                setSelectedNode={setSelectedNode}
                theme={theme}
                onViewDiff={onViewDiff}
                pendingPermission={pendingPermission}
                respondToPermission={(id, ans) => respondToPermission(id, ans)}
            />
        </div>
    );
}