// filepath: bridge_client/src/components/terminal/VisualFlow.tsx
import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Handle,
    Position,
    Node,
    Edge,
    useNodesState,
    useEdgesState
} from "reactflow";
import "reactflow/dist/style.css";
import { useSSE, ChatMessage, ExecutionStep } from "../../hooks/useSSE";
import { ChatInputForm } from "./ChatInputForm";
import { WorkspaceData } from "../../App";
import { AnimatePresence } from "motion/react";
import { marked } from "marked";
import { StructuredQuestionsForm } from "./StructuredQuestionsForm";
// =================================================================
// 🌌 CUSTOM MULTI-THEME NEON NODES COMPONENTS FOR REACTFLOW
// =================================================================

const CyberGroupNode = ({ data }: any) => {
    const isDark = data.theme !== 'light';
    return (
        <div
            style={{ width: data.width, height: data.height }}
            className={`rounded-2xl border pointer-events-none select-none p-3 text-left transition-all duration-200 ${isDark
                ? 'bg-zinc-950/20 border-zinc-800/40 text-zinc-550'
                : 'bg-zinc-100/30 border-zinc-200/60 text-zinc-400'
                }`}
        >
            <div className={`absolute top-2.5 left-4 text-[9px] font-bold font-mono uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                {data.label}
            </div>
        </div>
    );
};

const CyberUserNode = ({ data }: any) => {
    const isDark = data.theme !== 'light';
    const bgClass = isDark
        ? "bg-zinc-950/90 text-cyan-400 border-cyan-400 glow-neon-cyan"
        : "bg-white/95 text-cyan-600 border-cyan-400 shadow-md";
    const contentColor = isDark ? "text-zinc-300" : "text-zinc-700";

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono font-bold relative min-w-[200px] max-w-[260px] text-left transition-all duration-200 ${bgClass}`}>
            <div className={`absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black ${isDark ? "text-cyan-500" : "text-cyan-600"}`}>User Input</div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none ${isDark ? "border-cyan-500/20" : "border-cyan-200"}`}>
                <span>💬</span> PROMPT DECK
            </div>
            <div className={`text-[11px] font-semibold line-clamp-3 select-text whitespace-pre-wrap leading-relaxed ${contentColor}`}>
                {data.content}
            </div>
            {data.images && data.images.length > 0 && (
                <div className="mt-1.5 flex gap-1 select-none">
                    {data.images.map((img: string, idx: number) => (
                        <img key={idx} src={img} className={`w-8 h-8 rounded border object-cover ${isDark ? "border-cyan-400/30" : "border-cyan-300"}`} alt="pasted" />
                    ))}
                </div>
            )}
            <Handle type="source" position={Position.Right} style={{ background: isDark ? '#00f0ff' : '#0ea5e9', borderColor: isDark ? '#00f0ff' : '#0ea5e9', width: '8px', height: '8px' }} />
        </div>
    );
};

const CyberAgentNode = ({ data }: any) => {
    const isDark = data.theme !== 'light';
    const isOrchestrator = data.name.includes("Orchestrator");

    let glowClass = "";
    if (isDark) {
        glowClass = isOrchestrator
            ? "glow-neon-yellow border-amber-400 text-amber-400 bg-zinc-950/90"
            : "glow-neon-magenta border-purple-400 text-purple-400 bg-zinc-950/90";
    } else {
        glowClass = isOrchestrator
            ? "border-amber-500 text-amber-600 bg-white/95 shadow-md"
            : "border-purple-500 text-purple-600 bg-white/95 shadow-md";
    }

    const stateColor = data.state === "running" || data.state === "thinking"
        ? "text-amber-500 animate-pulse font-bold"
        : "text-emerald-500 font-bold";

    const labelColor = isDark ? "text-zinc-400" : "text-zinc-600";
    const borderLineColor = isDark ? "border-zinc-800" : "border-zinc-200";

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono shadow-lg relative min-w-[200px] max-w-[260px] text-left transition-all duration-200 ${glowClass}`}>
            <div className={`absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80 ${isDark ? "" : "text-zinc-500"}`}>
                {isOrchestrator ? "Master Agent" : "Worker Agent"}
            </div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none ${borderLineColor}`}>
                <span>{isOrchestrator ? "👑" : "🤖"}</span> {data.name}
            </div>
            <div className="space-y-1">
                <div className={`text-[10px] font-medium leading-normal ${labelColor}`}>
                    <span className={`${isDark ? "text-zinc-500" : "text-zinc-400"} font-semibold`}>Role:</span> {data.role}
                </div>
                <div className={`text-[10px] font-medium ${labelColor}`}>
                    <span className={`${isDark ? "text-zinc-500" : "text-zinc-400"} font-semibold`}>Model:</span> <span className="font-bold" style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>{data.model}</span>
                </div>
                <div className={`text-[9px] mt-1 pt-1 border-t flex justify-between select-none ${borderLineColor}`}>
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Status:</span>
                    <span className={stateColor}>{data.state?.toUpperCase()}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: isOrchestrator ? '#ffb700' : '#ff007f', width: '8px', height: '8px' }} />
            <Handle type="source" position={Position.Right} style={{ background: isOrchestrator ? '#ffb700' : '#ff007f', width: '8px', height: '8px' }} />
        </div>
    );
};

const CyberToolNode = ({ data }: any) => {
    const isDark = data.theme !== 'light';
    const isFailed = data.state === "failed";

    let borderGlowClass = "";
    if (isDark) {
        borderGlowClass = isFailed
            ? "glow-neon-magenta border-red-500 text-red-500 bg-zinc-950/90"
            : data.state === "completed"
                ? "glow-neon-green border-emerald-400 text-emerald-400 bg-zinc-950/90"
                : "glow-neon-orange border-orange-400 text-orange-400 bg-zinc-950/90";
    } else {
        borderGlowClass = isFailed
            ? "border-red-500 text-red-600 bg-white/95 shadow-md"
            : data.state === "completed"
                ? "border-emerald-500 text-emerald-600 bg-white/95 shadow-md"
                : "border-orange-500 text-orange-600 bg-white/95 shadow-md";
    }

    const stateColor = isFailed
        ? "text-red-500 font-bold"
        : data.state === "completed"
            ? "text-emerald-500 font-bold"
            : "text-orange-500 animate-pulse font-bold";

    const borderLineColor = isDark ? "border-zinc-800" : "border-zinc-200";
    const labelColor = isDark ? "text-zinc-400" : "text-zinc-600";

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono shadow-lg relative min-w-[200px] max-w-[260px] text-left transition-all duration-200 ${borderGlowClass}`}>
            <div className={`absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80 ${isDark ? "" : "text-zinc-500"}`}>
                System Action
            </div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none ${borderLineColor}`}>
                <span>⚙️</span> TOOL EXECUTION
            </div>
            <div className="space-y-1">
                <div className={`text-[11px] font-bold truncate font-mono ${isDark ? "text-zinc-100" : "text-zinc-800"}`}>
                    {data.tool}
                </div>
                <div className={`text-[10px] font-medium line-clamp-1 truncate select-text ${labelColor}`} title={data.title}>
                    {data.title}
                </div>
                <div className={`text-[9px] mt-1 pt-1 border-t flex justify-between select-none ${borderLineColor}`}>
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Status:</span>
                    <span className={stateColor}>{data.state?.toUpperCase()}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#ff5e00', width: '8px', height: '8px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#ff5e00', width: '8px', height: '8px' }} />
        </div>
    );
};

const CyberValidatorNode = ({ data }: any) => {
    const isDark = data.theme !== 'light';
    const isFailed = data.state === "failed" || data.state === "blocked";

    let borderGlowClass = "";
    if (isDark) {
        borderGlowClass = isFailed
            ? "glow-neon-magenta border-red-500 text-red-500 bg-zinc-950/90"
            : data.state === "passed"
                ? "glow-neon-green border-emerald-400 text-emerald-400 bg-zinc-950/90"
                : "glow-neon-cyan border-cyan-400 text-cyan-400 bg-zinc-950/90";
    } else {
        borderGlowClass = isFailed
            ? "border-red-500 text-red-600 bg-white/95 shadow-md"
            : data.state === "passed"
                ? "border-emerald-500 text-emerald-600 bg-white/95 shadow-md"
                : "border-cyan-500 text-cyan-600 bg-white/95 shadow-md";
    }

    const stateColor = isFailed
        ? "text-red-500 font-bold animate-pulse"
        : data.state === "passed"
            ? "text-emerald-500 font-bold"
            : "text-cyan-500 animate-pulse font-bold";

    const borderLineColor = isDark ? "border-zinc-800" : "border-zinc-200";

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono shadow-lg relative min-w-[200px] max-w-[260px] text-left transition-all duration-200 ${borderGlowClass}`}>
            <div className={`absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80 ${isDark ? "" : "text-zinc-500"}`}>
                Strict Quality Gate
            </div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none ${borderLineColor}`}>
                <span>🛡️</span> {data.name}
            </div>
            <div className="space-y-1">
                <div className={`text-[9px] mt-1 pt-1 flex justify-between select-none ${borderLineColor}`}>
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Verdict:</span>
                    <span className={stateColor}>{data.state?.toUpperCase()}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#ff007f', width: '8px', height: '8px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#ff007f', width: '8px', height: '8px' }} />
        </div>
    );
};

const nodeTypes = {
    cyberUser: CyberUserNode,
    cyberAgent: CyberAgentNode,
    cyberTool: CyberToolNode,
    cyberValidator: CyberValidatorNode,
    cyberGroup: CyberGroupNode
};

// =================================================================
// 🚀 MAIN VISUALFLOW COMPONENT (TAB PANEL)
// =================================================================
interface VisualFlowProps {
    activeAgent: "MaxHermes" | "MaxClaw";
    activeModel: string;
    setActiveModel: (model: string) => void;
    sse: ReturnType<typeof useSSE>;
    workspaceData: WorkspaceData | null;
    onViewDiff?: (filePath: string) => void;
}

export function VisualFlow({
    activeAgent,
    activeModel,
    setActiveModel,
    sse,
    workspaceData,
    onViewDiff
}: VisualFlowProps) {
    const { messages, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration } = sse;

    const [realProviders, setRealProviders] = useState<any[]>([]);
    const [availableCommands, setAvailableCommands] = useState<any[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // SỬA ĐỔI: Khởi tạo Chế độ lọc xem (Toàn bộ / Chỉ xem lượt hiện hành)
    const [viewMode, setViewMode] = useState<'full' | 'active'>(() => {
        try {
            const saved = localStorage.getItem('bridge_flow_view_mode');
            return (saved === 'full' || saved === 'active') ? saved : 'full';
        } catch {
            return 'full';
        }
    });

    // Khởi tạo Theme Sáng/Tối và lưu bền vững vào localStorage
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        try {
            const saved = localStorage.getItem('bridge_flow_theme');
            return (saved === 'light' || saved === 'dark') ? saved : 'dark';
        } catch {
            return 'dark';
        }
    });

    // Khởi tạo kích thước Panel và lưu bền vững vào localStorage
    const [panelWidth, setPanelWidth] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('bridge_response_panel_width');
            return saved ? parseInt(saved, 10) : 420;
        } catch {
            return 420;
        }
    });

    const [panelHeight, setPanelHeight] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('bridge_response_panel_height');
            return saved ? parseInt(saved, 10) : 350;
        } catch {
            return 350;
        }
    });

    const [showResponsePanel, setShowResponsePanel] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('bridge_show_response_panel');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    // Đồng bộ thay đổi kích thước & Theme lên localStorage
    useEffect(() => {
        localStorage.setItem('bridge_flow_theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('bridge_flow_view_mode', viewMode);
    }, [viewMode]);

    useEffect(() => {
        localStorage.setItem('bridge_response_panel_width', panelWidth.toString());
    }, [panelWidth]);

    useEffect(() => {
        localStorage.setItem('bridge_response_panel_height', panelHeight.toString());
    }, [panelHeight]);

    useEffect(() => {
        localStorage.setItem('bridge_show_response_panel', JSON.stringify(showResponsePanel));
    }, [showResponsePanel]);

    // Khai báo quản lý trạng thái Node / Edge bằng Hook chuyên dụng
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Sync nodes state with a ref to read current drag positions
    const nodesRef = useRef<Node[]>([]);
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        fetch('/api/provider/config')
            .then((res) => res.json())
            .then((data) => {
                if (data && data.providers) {
                    const list = Object.entries(data.providers)
                        .filter(([_, p]: any) => p.enabled)
                        .map(([key, p]: any) => ({ key, name: p.name || key }));
                    setRealProviders(list);
                }
            });

        fetch('/api/dashboard/commands')
            .then((res) => res.json())
            .then((data) => {
                if (data.cli) setAvailableCommands(data.cli);
            });
    }, []);

    const handleSwitchProvider = (providerKey: string, providerName: string) => {
        fetch('/api/provider/switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: providerKey })
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setActiveModel(providerName);
            });
    };

    // Tìm phản hồi cuối cùng từ AI
    const lastAssistantMessage = useMemo(() => {
        return [...messages].reverse().find(m => m.role === 'assistant');
    }, [messages]);

    const lastAssistantContentHtml = useMemo(() => {
        if (!lastAssistantMessage || !lastAssistantMessage.content) return '';
        try {
            return marked.parse(lastAssistantMessage.content) as string;
        } catch (e) {
            return lastAssistantMessage.content;
        }
    }, [lastAssistantMessage]);

    // Parse Markdown của Node đang được chọn trong Inspector
    const inspectorHtml = useMemo(() => {
        if (!selectedNode || !selectedNode.data.content) return '';
        try {
            return marked.parse(selectedNode.data.content) as string;
        } catch (e) {
            return selectedNode.data.content;
        }
    }, [selectedNode]);

    // Lọc danh sách tin nhắn hiển thị tùy chế độ (Toàn bộ / Lượt hiện tại)
    const filteredMessages = useMemo(() => {
        if (viewMode === 'full') return messages;

        // Chế độ Focus: Tìm và chỉ trích xuất duy nhất Turn hội thoại cuối cùng
        const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
        if (lastUserIdx === -1) return messages;

        const actualIdx = messages.length - 1 - lastUserIdx;
        return messages.slice(actualIdx);
    }, [messages, viewMode]);

    // Phân rã cấu trúc tin nhắn phẳng thành các "Turn" có cấu trúc
    const structuredTurns = useMemo(() => {
        const turns: Array<{ user?: ChatMessage; assistant?: ChatMessage; userIdx?: number; assistantIdx?: number }> = [];
        let currentTurn: any = {};

        filteredMessages.forEach((msg, idx) => {
            // Định vị lại chỉ số gốc (index) của tin nhắn trong mảng messages chính thức
            const originalIndex = messages.indexOf(msg);
            const actualIndex = originalIndex !== -1 ? originalIndex : idx;

            if (msg.role === 'user') {
                if (currentTurn.user) {
                    turns.push(currentTurn);
                    currentTurn = {};
                }
                currentTurn.user = msg;
                currentTurn.userIdx = actualIndex;
            } else if (msg.role === 'assistant') {
                currentTurn.assistant = msg;
                currentTurn.assistantIdx = actualIndex;
                turns.push(currentTurn);
                currentTurn = {};
            }
        });
        if (currentTurn.user || currentTurn.assistant) {
            turns.push(currentTurn);
        }
        return turns;
    }, [filteredMessages, messages]);

    // Xử lý kéo dãn Panel (Resize Handler)
    const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            w: panelWidth,
            h: panelHeight
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeStart.current) return;
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;

        // Vì panel neo góc bên phải, kéo chuột sang bên trái (deltaX âm) -> rộng ra
        const newWidth = Math.max(260, Math.min(900, resizeStart.current.w - deltaX));
        // Kéo chuột xuống dưới (deltaY dương) -> cao lên
        const newHeight = Math.max(150, Math.min(700, resizeStart.current.h + deltaY));

        setPanelWidth(newWidth);
        setPanelHeight(newHeight);
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        resizeStart.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // 🧬 ĐỒNG BỘ TRẠNG THÁI: Tự động chuyển đổi chuỗi tin nhắn sang Node & Edge khi có thay đổi
    useEffect(() => {
        const nodesList: Node[] = [];
        const edgesList: Edge[] = [];
        let lastNodeId: string | null = null;
        let latestUserNodeId: string | null = null; // Theo dõi prompt người dùng gần nhất để liên kết đầu vào

        const colX = {
            user: 50,
            orchestrator: 400,
            worker: 750,
            tool: 1100,
            validator: 1450
        };

        const layerY = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60 };

        // Khai báo biến hỗ trợ hiển thị pipeline động
        const runningStepKey = workspaceData?.activeTask?.step_key || '';
        const currentStepMap = workspaceData?.states || [];

        // Helper chèn node có bảo toàn tọa độ kéo thả từ Ref kèm tiêm (inject) Theme hiện hành
        const addNode = (node: Node) => {
            const existingNode = nodesRef.current.find(n => n.id === node.id);
            if (existingNode) {
                node.position = existingNode.position;
            }
            node.data = { ...node.data, theme }; // Tiêm theme vào data
            nodesList.push(node);
        };

        structuredTurns.forEach((turn, tIdx) => {
            // Ghi nhận toạ độ biên trên (Top Bound) của lượt này
            const turnStartY = Math.min(layerY[0], layerY[1], layerY[2], layerY[3], layerY[4]);

            // 1. RENDER PROMPT DECK CỦA USER
            if (turn.user) {
                const userNodeId = `user-${turn.userIdx}`;
                addNode({
                    id: userNodeId,
                    type: 'cyberUser',
                    data: { content: turn.user.content, images: turn.user.images },
                    position: { x: colX.user, y: layerY[0] }
                });

                // Vẽ đường nối vuông góc tuần tự (Sequence) nối tiếp giữa các phiên hội thoại nếu có
                if (lastNodeId) {
                    edgesList.push({
                        id: `edge-seq-${lastNodeId}-${userNodeId}`,
                        source: lastNodeId,
                        target: userNodeId,
                        type: 'smoothstep',
                        animated: false,
                        style: {
                            stroke: theme === 'dark' ? '#00f0ff' : '#0ea5e9',
                            strokeWidth: 1,
                            strokeDasharray: '4 4',
                            opacity: theme === 'dark' ? 0.3 : 0.6
                        }
                    });
                }

                lastNodeId = userNodeId;
                latestUserNodeId = userNodeId;
                layerY[0] += 200;
            }

            // 2. RENDER MASTER ORCHESTRATOR & CÁC WORKER AGENT CON
            if (turn.assistant) {
                const isLastMessage = turn.assistantIdx === messages.length - 1;
                const isStreaming = isLastMessage && isGenerating;
                const orchNodeId = `orchestrator-${turn.assistantIdx}`;

                addNode({
                    id: orchNodeId,
                    type: 'cyberAgent',
                    data: {
                        name: "Master Orchestrator",
                        role: "Lead Technical Architect",
                        model: "System Host",
                        state: isStreaming && (!turn.assistant.steps || turn.assistant.steps.length === 0) ? 'thinking' : 'completed',
                        content: turn.assistant.content
                    },
                    position: { x: colX.orchestrator, y: layerY[1] }
                });

                // Liên kết Orchestrator trực tiếp với Prompt Deck thực tế của người dùng
                if (latestUserNodeId) {
                    edgesList.push({
                        id: `edge-${latestUserNodeId}-${orchNodeId}`,
                        source: latestUserNodeId,
                        target: orchNodeId,
                        type: 'smoothstep',
                        animated: isStreaming && (!turn.assistant.steps || turn.assistant.steps.length === 0),
                        style: {
                            stroke: theme === 'dark' ? '#ffb700' : '#d97706',
                            strokeWidth: 2,
                            filter: theme === 'dark' ? 'drop-shadow(0 0 5px #ffb700)' : undefined
                        }
                    });
                }

                lastNodeId = orchNodeId;
                layerY[1] += 220;

                if (turn.assistant.steps && turn.assistant.steps.length > 0) {
                    const workerNodeId = `worker-${turn.assistantIdx}`;
                    addNode({
                        id: workerNodeId,
                        type: 'cyberAgent',
                        data: {
                            name: "Specialist Worker",
                            role: "Code & Terminal Executor",
                            model: activeModel,
                            state: isStreaming ? 'running' : 'completed'
                        },
                        position: { x: colX.worker, y: layerY[2] }
                    });

                    edgesList.push({
                        id: `edge-${orchNodeId}-${workerNodeId}`,
                        source: orchNodeId,
                        target: workerNodeId,
                        type: 'smoothstep',
                        animated: isStreaming,
                        style: {
                            stroke: theme === 'dark' ? '#ff007f' : '#c026d3',
                            strokeWidth: 2,
                            filter: theme === 'dark' ? 'drop-shadow(0 0 5px #ff007f)' : undefined
                        }
                    });

                    let lastToolNodeId: string | null = null;

                    turn.assistant.steps.forEach((step: ExecutionStep, sIdx: number) => {
                        const stepNodeId = `step-${step.id || `${turn.assistantIdx}-${sIdx}`}`;
                        const isLastStep = sIdx === turn.assistant!.steps!.length - 1;
                        const isStepRunning = isLastStep && isStreaming && !step.output;

                        if (step.type === 'agent') {
                            // RENDER CÁC WORKER SUB-AGENTS CHUYÊN BIỆT THÀNH CYBERAGENT CHÍNH THỨC
                            addNode({
                                id: stepNodeId,
                                type: 'cyberAgent',
                                data: {
                                    name: step.title || "Worker Agent",
                                    role: "Specialist Sub-Agent",
                                    model: step.toolName || "Worker",
                                    state: step.output ? 'completed' : (isStepRunning ? 'running' : 'completed'),
                                    content: step.output || step.input
                                },
                                position: { x: colX.worker, y: layerY[2] }
                            });

                            edgesList.push({
                                id: `edge-${workerNodeId}-${stepNodeId}`,
                                source: workerNodeId,
                                target: stepNodeId,
                                type: 'smoothstep',
                                animated: isStepRunning,
                                style: {
                                    stroke: theme === 'dark' ? '#ff007f' : '#c026d3',
                                    strokeWidth: 2,
                                    filter: theme === 'dark' ? 'drop-shadow(0 0 5px #ff007f)' : undefined
                                }
                            });

                            lastToolNodeId = stepNodeId;
                            layerY[2] += 220;
                        } else {
                            // VẼ CÁC SYSTEM ACTION TIÊU CHUẨN (CÓ SMOOTHSTEP)
                            addNode({
                                id: stepNodeId,
                                type: 'cyberTool',
                                data: {
                                    title: step.title,
                                    tool: step.toolName || step.type,
                                    input: step.input,
                                    output: step.output,
                                    state: step.output ? 'completed' : (isStepRunning ? 'running' : 'completed')
                                },
                                position: { x: colX.tool, y: layerY[3] }
                            });

                            edgesList.push({
                                id: `edge-${workerNodeId}-${stepNodeId}`,
                                source: workerNodeId,
                                target: stepNodeId,
                                type: 'smoothstep',
                                animated: isStepRunning,
                                style: {
                                    stroke: step.output
                                        ? (theme === 'dark' ? '#39ff14' : '#16a34a')
                                        : (theme === 'dark' ? '#ff5e00' : '#ea580c'),
                                    strokeWidth: 1.5,
                                    filter: theme === 'dark'
                                        ? (step.output ? 'drop-shadow(0 0 3px #39ff14)' : 'drop-shadow(0 0 3px #ff5e00)')
                                        : undefined
                                }
                            });

                            lastToolNodeId = stepNodeId;
                            layerY[3] += 180;
                        }
                    });

                    lastNodeId = lastToolNodeId || workerNodeId;
                    layerY[2] += 220;
                }

                const isPipelineStepActive = workspaceData?.pipeline && runningStepKey;
                const currentActiveStep = currentStepMap.find(s => s.step_key === runningStepKey);

                if (isPipelineStepActive && isLastMessage && currentActiveStep) {
                    const valNodeId = `validator-${turn.assistantIdx}`;
                    const isValRunning = currentActiveStep.state === 'VALIDATING';
                    const isBlocked = currentActiveStep.state === 'BLOCKED' || currentActiveStep.state === 'FAILED';

                    addNode({
                        id: valNodeId,
                        type: 'cyberValidator',
                        data: {
                            name: "Quality Validator",
                            state: isValRunning ? 'validating' : isBlocked ? 'blocked' : 'passed'
                        },
                        position: { x: colX.validator, y: layerY[4] }
                    });

                    edgesList.push({
                        id: `edge-${lastNodeId}-${valNodeId}`,
                        source: lastNodeId!,
                        target: valNodeId,
                        type: 'smoothstep',
                        animated: isValRunning,
                        style: {
                            stroke: isValRunning
                                ? (theme === 'dark' ? '#00f0ff' : '#0284c7')
                                : isBlocked
                                    ? (theme === 'dark' ? '#ff007f' : '#dc2626')
                                    : (theme === 'dark' ? '#39ff14' : '#16a34a'),
                            strokeWidth: 2,
                            filter: theme === 'dark'
                                ? (isValRunning ? 'drop-shadow(0 0 5px #00f0ff)' : isBlocked ? 'drop-shadow(0 0 5px #ff007f)' : 'drop-shadow(0 0 5px #39ff14)')
                                : undefined
                        }
                    });

                    lastNodeId = valNodeId;
                    layerY[4] += 180;
                }
            }

            // Ghi nhận toạ độ biên dưới (Bottom Bound) và vẽ hộp nhóm cho lượt hội thoại này
            const turnEndY = Math.max(layerY[0], layerY[1], layerY[2], layerY[3], layerY[4]);
            const turnHeight = turnEndY - turnStartY;

            // Chèn node group vào đầu danh sách để làm hình nền nằm dưới
            const displayIdx = messages.indexOf(turn.user || turn.assistant || {} as ChatMessage);
            const turnNumber = displayIdx !== -1 ? Math.floor(displayIdx / 2) + 1 : tIdx + 1;
            const turnLabel = turn.user
                ? `Lượt #${turnNumber}: "${turn.user.content.substring(0, 45)}${turn.user.content.length > 45 ? '...' : ''}"`
                : `Lượt #${turnNumber}`;

            nodesList.unshift({
                id: `group-${tIdx}`,
                type: 'cyberGroup',
                data: {
                    label: turnLabel,
                    width: 1540,
                    height: turnHeight + 40,
                    theme
                },
                position: { x: 20, y: turnStartY - 20 },
                style: { pointerEvents: 'none', zIndex: -1 }
            });

            // Tự động dịch chuyển dòng biên để lượt hội thoại sau nằm bên dưới lượt trước
            const nextTurnGap = 80;
            layerY[0] = turnEndY + nextTurnGap;
            layerY[1] = turnEndY + nextTurnGap;
            layerY[2] = turnEndY + nextTurnGap;
            layerY[3] = turnEndY + nextTurnGap;
            layerY[4] = turnEndY + nextTurnGap;
        });

        setNodes(nodesList as any);
        setEdges(edgesList as any);
    }, [messages, isGenerating, activeModel, workspaceData, setNodes, setEdges, theme, viewMode, structuredTurns]);

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden relative select-none transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-100 text-zinc-800'}`} style={{ height: '100%', minHeight: '500px' }}>

            {/* REACTFLOW MAIN CANVAS */}
            <div className="flex-1 h-full w-full relative" style={{ height: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, node) => setSelectedNode(node)}
                    fitView
                    fitViewOptions={{ padding: 0.15 }}
                    className={theme === 'dark' ? 'bg-[#05050c]' : 'bg-[#f4f4f5]'}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color={theme === 'dark' ? '#312e81' : '#cbd5e1'} gap={16} size={1} />
                    <Controls className={theme === 'dark' ? 'bg-zinc-900 border border-zinc-800 text-zinc-100' : 'bg-white border border-zinc-200 text-zinc-800'} />
                    <MiniMap
                        nodeStrokeColor={(n) => {
                            if (n.type === 'cyberUser') return theme === 'dark' ? '#00f0ff' : '#0ea5e9';
                            if (n.type === 'cyberTool') return theme === 'dark' ? '#ff5e00' : '#ea580c';
                            return theme === 'dark' ? '#ffb700' : '#d97706';
                        }}
                        nodeColor={(n) => (n.type === 'cyberUser' ? (theme === 'dark' ? '#00f0ff33' : '#0ea5e933') : (theme === 'dark' ? '#ff5e0033' : '#ea580c33'))}
                        className={theme === 'dark' ? 'bg-zinc-900/90 border border-zinc-800' : 'bg-white/90 border border-zinc-200'}
                        maskColor={theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)'}
                    />
                </ReactFlow>

                {/* 🌗 FLOATING THEME TOGGLE & VIEW MODE CONTROL PANEL */}
                <div className="absolute top-4 left-4 z-40 flex gap-2 pointer-events-auto select-none">
                    <button
                        type="button"
                        onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
                        className={`border rounded-lg p-2 text-xs font-bold cursor-pointer shadow-lg flex items-center gap-1.5 transition-all duration-200 ${theme === 'dark'
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:text-white'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                            }`}
                        title="Chuyển đổi giao diện Sáng / Tối"
                    >
                        <span>{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'Sáng' : 'Tối'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setViewMode(prev => prev === 'full' ? 'active' : 'full')}
                        className={`border rounded-lg p-2 text-xs font-bold cursor-pointer shadow-lg flex items-center gap-1.5 transition-all duration-200 ${theme === 'dark'
                            ? 'bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:text-white'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                            }`}
                        title="Tập trung lượt hội thoại hiện tại / Xem toàn bộ"
                    >
                        <span>{viewMode === 'full' ? '👁️' : '🎯'}</span> {viewMode === 'full' ? 'Xem toàn bộ' : 'Chỉ lượt hiện tại'}
                    </button>
                </div>

                {/* 🤖 FLOATING LATEST AI RESPONSE OVERLAY PANEL (WITH DYNAMIC RESIZING & COOPERATING MARKDOWN THEME) */}
                {lastAssistantMessage && (
                    <div className="absolute top-4 right-4 z-40 flex flex-col items-end pointer-events-none select-none">
                        <button
                            type="button"
                            onClick={() => setShowResponsePanel(!showResponsePanel)}
                            className={`border text-xs font-semibold cursor-pointer shadow-lg flex items-center gap-1.5 pointer-events-auto rounded-lg p-2 transition-colors ${theme === 'dark'
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:text-white'
                                : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900'
                                }`}
                        >
                            <span>{showResponsePanel ? '👉' : '👈'}</span> AI Output Panel
                        </button>

                        {showResponsePanel && (
                            <div
                                style={{ width: `${panelWidth}px`, height: `${panelHeight}px` }}
                                className={`mt-2 border rounded-xl shadow-2xl p-4 backdrop-blur-md text-left pointer-events-auto select-text relative flex flex-col transition-colors ${theme === 'dark'
                                    ? 'bg-zinc-950/95 border-zinc-800 text-zinc-200'
                                    : 'bg-white/95 border-zinc-200 text-zinc-800'
                                    }`}
                            >
                                <h3 className={`text-[10px] font-bold uppercase tracking-widest font-mono mb-2 pb-1.5 border-b select-none ${theme === 'dark' ? 'text-cyan-400 border-zinc-800' : 'text-cyan-600 border-zinc-200'
                                    }`}>
                                    🤖 Latest Assistant Output
                                </h3>
                                <div
                                    className={`text-[14px] leading-relaxed select-text flex-1 overflow-y-auto scrollbar-thin pr-1 ${theme === 'dark' ? 'markdown-body-dark' : 'markdown-body'
                                        }`}
                                    dangerouslySetInnerHTML={{ __html: lastAssistantContentHtml }}
                                />

                                {/* Diagonal Resize Handle at bottom-left corner */}
                                <div
                                    onPointerDown={handleResizePointerDown}
                                    onPointerMove={handleResizePointerMove}
                                    onPointerUp={handleResizePointerUp}
                                    onPointerCancel={handleResizePointerUp}
                                    className="absolute bottom-1 left-1 w-5 h-5 cursor-nesw-resize flex items-end justify-start p-0.5 select-none z-50 group/resize pointer-events-auto"
                                    style={{ touchAction: 'none' }}
                                    title="Kéo thả để điều chỉnh kích thước"
                                >
                                    <svg width="10" height="10" viewBox="0 0 10 10" className="text-zinc-600 group-hover/resize:text-cyan-400 transition-colors">
                                        <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="1.5" />
                                        <line x1="0" y1="5" x2="5" y2="0" stroke="currentColor" strokeWidth="1" />
                                    </svg>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* FLOATING RETRO DECK CHAT OVERLAY */}
                <div className="absolute bottom-4 left-4 right-4 z-50 max-w-4xl mx-auto select-none pointer-events-auto">
                    <ChatInputForm
                        activeAgent={activeAgent}
                        currentActiveModelName={workspaceData?.provider?.name || activeModel}
                        realProviders={realProviders}
                        handleSwitchProvider={handleSwitchProvider}
                        isGenerating={isGenerating}
                        stopGeneration={stopGeneration}
                        availableCommands={availableCommands}
                        onSendMessage={(prompt, useRef, useHeadless, images, mode) => {
                            setSelectedNode(null);
                            sendPrompt(prompt, useRef, images, activeAgent, activeModel, useHeadless, mode);
                        }}
                    />
                </div>
            </div>

            {/* STRUCTURED PERMISSION HITL OVERLAY */}
            {pendingPermission && (() => {
                let structuredQuestions = null;
                if (pendingPermission.details && pendingPermission.details.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(pendingPermission.details);
                        if (parsed.type === 'structured_questions') {
                            structuredQuestions = parsed;
                        }
                    } catch { }
                }

                // Nếu phát hiện dữ liệu là Structured Questions, dựng giao diện wizard trực quan
                if (structuredQuestions) {
                    return (
                        <div className="absolute top-4 left-4 right-4 z-50 max-w-md mx-auto p-4 bg-white border border-zinc-200 rounded-xl space-y-3 shadow-xl text-left relative overflow-hidden text-zinc-800">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-amber-500" />
                            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px] font-mono select-none">
                                <span className="animate-pulse">❓</span> YÊU CẦU LÀM RÕ THÔNG TIN (STRUCTURED WIZARD)
                            </div>
                            <StructuredQuestionsForm
                                data={structuredQuestions}
                                onSubmit={(ans) => respondToPermission(pendingPermission.id, JSON.stringify(ans))}
                                onCancel={() => respondToPermission(pendingPermission.id, 'n')}
                            />
                        </div>
                    );
                }

                // Fallback đối với các yêu cầu xác nhận Terminal hoặc Sửa file thông thường
                return (
                    <div className="absolute top-4 left-4 right-4 z-50 max-w-md mx-auto p-4 bg-zinc-900 border border-amber-500 rounded-xl space-y-3 shadow-[0_0_20px_rgba(245,158,11,0.2)] text-left select-text">
                        <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[11px] font-mono">
                            <span className="animate-pulse">⚠️</span> hitl approval required
                        </div>
                        <p className="text-[11px] text-zinc-200 leading-relaxed font-semibold">
                            {pendingPermission.query}
                        </p>
                        {pendingPermission.details && (
                            <pre className="p-2 bg-black border border-zinc-800 text-[10px] text-zinc-400 font-mono rounded overflow-auto max-h-24 whitespace-pre-wrap">
                                {pendingPermission.details}
                            </pre>
                        )}
                        <div className="flex gap-1.5 justify-end">
                            <button
                                onClick={() => respondToPermission(pendingPermission.id, 'n')}
                                className="px-2.5 py-1.5 border border-red-500 bg-red-950/20 text-red-500 rounded-lg text-[10px] font-mono font-bold hover:bg-red-500/20 transition-all cursor-pointer"
                            >
                                DENY
                            </button>
                            <button
                                onClick={() => respondToPermission(pendingPermission.id, 'y')}
                                className="px-2.5 py-1.5 border border-blue-500 bg-blue-950/20 text-blue-400 rounded-lg text-[10px] font-mono font-bold hover:bg-blue-50/20 transition-all cursor-pointer"
                            >
                                APPROVE (YES)
                            </button>
                            <button
                                onClick={() => respondToPermission(pendingPermission.id, 'a')}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer"
                            >
                                APPROVE ALL
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Cyberpunk Inspector Panel (LIGHTBOX MODAL WITH DYNAMIC THEMING) */}
            <AnimatePresence>
                {selectedNode && (
                    <div
                        className={`fixed inset-0 z-[99999] flex items-center justify-center p-4 select-text transition-colors duration-200 ${theme === 'dark' ? 'bg-black/85' : 'bg-zinc-900/60 backdrop-blur-xs'
                            }`}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelectedNode(null);
                        }}
                    >
                        <div
                            className={`border rounded-2xl w-full max-w-3xl h-[80vh] max-h-[85vh] overflow-hidden flex flex-col relative transition-all duration-200 ${theme === 'dark'
                                ? 'bg-zinc-950 border-zinc-800 text-zinc-100'
                                : 'bg-white border-zinc-200 text-zinc-800 shadow-2xl'
                                }`}
                            style={{
                                animation: 'zoomIn 0.2s ease-out',
                                boxShadow: theme === 'dark' ? '0 0 30px rgba(0, 240, 255, 0.1)' : undefined
                            }}
                        >
                            {/* Header */}
                            <div className={`px-6 py-4 flex justify-between items-center select-none shrink-0 transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-900 border-b border-zinc-800' : 'bg-zinc-50 border-b border-zinc-200'
                                }`}>
                                <div className="text-left">
                                    <h3 className={`text-xs font-bold uppercase tracking-widest font-mono ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'
                                        }`}>
                                        🤖 trace node inspector
                                    </h3>
                                    <p className={`text-[10px] font-mono mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'
                                        }`}>
                                        Node ID: {selectedNode.id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    className={`px-3.5 py-1.5 border rounded-lg text-xs font-mono font-bold cursor-pointer transition-colors ${theme === 'dark'
                                        ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-white'
                                        : 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-zinc-900'
                                        }`}
                                >
                                    CLOSE [Esc]
                                </button>
                            </div>

                            {/* Node Contents Display */}
                            <div className={`flex-1 overflow-auto p-6 space-y-5 text-left transition-colors duration-200 ${theme === 'dark' ? 'bg-[#020204]' : 'bg-white'
                                }`}>
                                <div className={`flex justify-between items-start flex-wrap gap-2 border-b pb-4 ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-100'
                                    }`}>
                                    <div>
                                        <h4 className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider mb-0.5">Node Type</h4>
                                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border transition-colors ${theme === 'dark'
                                            ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                            : 'bg-zinc-100 border-zinc-200 text-zinc-700'
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

                                {/* USER NODE DETAILS */}
                                {selectedNode.type === 'cyberUser' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-cyan-500' : 'text-cyan-600'}`}>💬 PROMPT CONTENT:</div>
                                            <div className={`p-4 border rounded-xl transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                                                }`}>
                                                <div
                                                    className={`text-[14px] leading-relaxed select-text ${theme === 'dark' ? 'markdown-body-dark' : 'markdown-body'
                                                        }`}
                                                    dangerouslySetInnerHTML={{ __html: inspectorHtml }}
                                                />
                                            </div>
                                        </div>
                                        {selectedNode.data.images && selectedNode.data.images.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-cyan-500' : 'text-cyan-600'}`}>🖼️ UPLOADED VISUAL DATA:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedNode.data.images.map((img: string, idx: number) => (
                                                        <img key={idx} src={img} className={`max-h-40 rounded border ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'}`} alt="visual" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* AGENT NODE DETAILS */}
                                {selectedNode.type === 'cyberAgent' && (
                                    <div className="space-y-4">
                                        <div className={`grid grid-cols-2 gap-4 text-xs font-mono transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-650'
                                            }`}>
                                            <div>• Name: <span className="font-bold" style={{ color: theme === 'dark' ? '#fff' : '#18181b' }}>{selectedNode.data.name}</span></div>
                                            <div>• Model: <span className="font-bold" style={{ color: theme === 'dark' ? '#60a5fa' : '#2563eb' }}>{selectedNode.data.model}</span></div>
                                            <div>• Role: <span className="font-semibold" style={{ color: theme === 'dark' ? '#e4e4e7' : '#3f3f46' }}>{selectedNode.data.role}</span></div>
                                        </div>
                                        {selectedNode.data.content && (
                                            <div className="space-y-1">
                                                <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-amber-500' : 'text-amber-600'}`}>🧠 THOUGHT PROCESS / RESPONSE:</div>
                                                <div className={`p-4 border rounded-xl transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                                                    }`}>
                                                    <div
                                                        className={`text-[14px] leading-relaxed select-text ${theme === 'dark' ? 'markdown-body-dark' : 'markdown-body'
                                                            }`}
                                                        dangerouslySetInnerHTML={{ __html: inspectorHtml }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TOOL NODE DETAILS */}
                                {selectedNode.type === 'cyberTool' && (
                                    <div className="space-y-4">
                                        <div className={`grid grid-cols-2 gap-4 text-xs font-mono transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-650'
                                            }`}>
                                            <div>• Tool: <span className="font-bold" style={{ color: theme === 'dark' ? '#f97316' : '#ea580c' }}>{selectedNode.data.tool}</span></div>
                                            <div>• Task Description: <span className="font-semibold" style={{ color: theme === 'dark' ? '#fff' : '#18181b' }}>{selectedNode.data.title}</span></div>
                                        </div>

                                        {/* RENDER CHI TIẾT FILE NẾU LÀ REPLACE/WRITE */}
                                        {selectedNode.data.tool === 'replace_content_safe' && selectedNode.data.input && (() => {
                                            try {
                                                const parsed = JSON.parse(selectedNode.data.input);
                                                return (
                                                    <div className={`space-y-3 pt-3 border-t ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
                                                        <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>📝 FILE MODIFICATION (REPLACE CONTENT SAFE)</div>
                                                        <div className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                                            • File Path:{" "}
                                                            <button
                                                                type="button"
                                                                onClick={() => onViewDiff && onViewDiff(parsed.file_path)}
                                                                className={`border px-2 py-0.5 rounded font-mono text-xs cursor-pointer select-text transition-colors ${theme === 'dark'
                                                                    ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-blue-400'
                                                                    : 'bg-zinc-100 border-zinc-200 hover:bg-zinc-200 text-blue-600'
                                                                    }`}
                                                            >
                                                                📄 {parsed.file_path} (Xem thay đổi 🔍)
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] font-bold text-rose-500 select-none">❌ TARGET CONTENT (DELETED):</div>
                                                                <pre className={`p-3 border rounded text-xs font-mono max-h-32 overflow-auto whitespace-pre select-text leading-normal transition-colors ${theme === 'dark'
                                                                    ? 'bg-red-950/20 border-red-900/40 text-rose-300'
                                                                    : 'bg-red-50 border-red-200 text-red-800'
                                                                    }`}>
                                                                    {parsed.target_content}
                                                                </pre>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] font-bold text-emerald-500 select-none">✅ REPLACEMENT CONTENT (ADDED):</div>
                                                                <pre className={`p-3 border rounded text-xs font-mono max-h-40 overflow-auto whitespace-pre select-text leading-normal transition-colors ${theme === 'dark'
                                                                    ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                                                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                                                    }`}>
                                                                    {parsed.replacement_content}
                                                                </pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            } catch { return null; }
                                        })()}

                                        {selectedNode.data.tool === 'write_file' && selectedNode.data.input && (() => {
                                            try {
                                                const parsed = JSON.parse(selectedNode.data.input);
                                                const content = parsed.content_base64 ? atob(parsed.content_base64) : parsed.content;
                                                return (
                                                    <div className={`space-y-3 pt-3 border-t ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
                                                        <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>💾 CREATE / OVERWRITE (WRITE FILE)</div>
                                                        <div className={`text-xs font-mono ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>• File Path: <code className={`px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-zinc-900 text-zinc-350' : 'bg-zinc-100 text-zinc-700'}`}>{parsed.file_path}</code></div>
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-bold text-teal-400 select-none">📝 FILE CONTENT:</div>
                                                            <pre className={`p-3 border rounded text-xs font-mono max-h-40 overflow-auto whitespace-pre select-text leading-normal transition-colors ${theme === 'dark'
                                                                ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                                                : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                                                                }`}>
                                                                {content}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                );
                                            } catch { return null; }
                                        })()}

                                        {/* Standard Tool Inputs */}
                                        {selectedNode.data.input && !['replace_content_safe', 'write_file'].includes(selectedNode.data.tool) && (
                                            <div className={`space-y-1.5 pt-3 border-t ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
                                                <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>⚙️ INPUT ARGUMENTS:</div>
                                                <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap select-text leading-relaxed transition-colors ${theme === 'dark'
                                                    ? 'bg-zinc-900 border-zinc-800 text-blue-400'
                                                    : 'bg-zinc-50 border-zinc-200 text-blue-600'
                                                    }`}>
                                                    {selectedNode.data.input}
                                                </pre>
                                            </div>
                                        )}

                                        {/* Tool Output / Result */}
                                        {selectedNode.data.output && (
                                            <div className={`space-y-1.5 pt-3 border-t ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
                                                <div className="text-xs font-bold select-none font-mono text-emerald-500">⚙️ OUTPUT RESPONSE:</div>
                                                <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-52 whitespace-pre select-text leading-normal transition-colors ${theme === 'dark'
                                                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                                                    : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                                                    }`}>
                                                    {(() => {
                                                        try {
                                                            const parsed = JSON.parse(selectedNode.data.output);
                                                            if (parsed.status === "success" && parsed.data) {
                                                                return typeof parsed.data === 'object' ? JSON.stringify(parsed.data, null, 2) : String(parsed.data);
                                                            }
                                                            return JSON.stringify(parsed, null, 2);
                                                        } catch {
                                                            return selectedNode.data.output;
                                                        }
                                                    })()}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* VALIDATOR NODE DETAILS */}
                                {selectedNode.type === 'cyberValidator' && (
                                    <div className="space-y-4">
                                        <div className={`text-xs font-mono transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-650'}`}>• Name: <span className="font-bold" style={{ color: theme === 'dark' ? '#fff' : '#18181b' }}>{selectedNode.data.name}</span></div>
                                        <div className="space-y-1">
                                            <div className="text-xs font-bold select-none font-mono text-pink-500">🛡️ VERDICT ANALYSIS:</div>
                                            <div className={`p-4 border rounded-xl text-xs font-sans select-text leading-relaxed whitespace-pre-wrap transition-colors ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                                                }`}>
                                                {selectedNode.data.state === 'passed' ? 'XÁC THỰC CÚ PHÁP & LOGIC THÀNH CÔNG. TẤT CẢ CHỈ SỐ PASS.' : 'ĐANG TRONG TIẾN TRÌNH XÁC THỰC...'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}