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
import { AnimatePresence, motion } from "motion/react";
import { marked } from "marked";

// =================================================================
// 🌌 CUSTOM NEON NODES COMPONENTS FOR REACTFLOW
// =================================================================

const CyberUserNode = ({ data }: any) => (
    <div className="px-4 py-3 rounded-xl border border-cyan-400 bg-zinc-950/90 text-cyan-400 text-xs font-mono font-bold glow-neon-cyan shadow-lg relative min-w-[200px] max-w-[260px] text-left">
        <div className="absolute top-0.5 right-2 text-[7px] text-cyan-500 select-none uppercase tracking-widest font-black">User Input</div>
        <div className="border-b border-cyan-500/20 pb-1 mb-1.5 flex items-center gap-1.5 select-none">
            <span>💬</span> PROMPT DECK
        </div>
        <div className="text-[11px] text-zinc-300 font-semibold line-clamp-3 select-text whitespace-pre-wrap leading-relaxed">
            {data.content}
        </div>
        {data.images && data.images.length > 0 && (
            <div className="mt-1.5 flex gap-1 select-none">
                {data.images.map((img: string, idx: number) => (
                    <img key={idx} src={img} className="w-8 h-8 rounded border border-cyan-400/30 object-cover" alt="pasted" />
                ))}
            </div>
        )}
        <Handle type="source" position={Position.Right} style={{ background: '#00f0ff', borderColor: '#00f0ff', width: '8px', height: '8px' }} />
    </div>
);

const CyberAgentNode = ({ data }: any) => {
    const isOrchestrator = data.name.includes("Orchestrator");
    const glowClass = isOrchestrator ? "glow-neon-yellow border-amber-400 text-amber-400" : "glow-neon-magenta border-purple-400 text-purple-400";
    const stateColor = data.state === "running" || data.state === "thinking" ? "text-amber-500 animate-pulse font-bold" : "text-emerald-500 font-bold";

    return (
        <div className={`px-4 py-3 rounded-xl border bg-zinc-950/90 text-xs font-mono glow-class shadow-lg relative min-w-[200px] max-w-[260px] text-left ${glowClass}`}>
            <div className="absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80">
                {isOrchestrator ? "Master Agent" : "Worker Agent"}
            </div>
            <div className="border-b border-zinc-800 pb-1 mb-1.5 flex items-center gap-1.5 select-none">
                <span>{isOrchestrator ? "👑" : "🤖"}</span> {data.name}
            </div>
            <div className="space-y-1">
                <div className="text-[10px] text-zinc-400 font-medium leading-normal">
                    <span className="text-zinc-500 font-semibold">Role:</span> {data.role}
                </div>
                <div className="text-[10px] text-zinc-400 font-medium">
                    <span className="text-zinc-500 font-semibold">Model:</span> <span className="text-blue-400 font-bold">{data.model}</span>
                </div>
                <div className="text-[9px] mt-1 pt-1 border-t border-zinc-900 flex justify-between select-none">
                    <span className="text-zinc-500">Status:</span>
                    <span className={stateColor}>{data.state?.toUpperCase()}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: isOrchestrator ? '#ffb700' : '#ff007f', width: '8px', height: '8px' }} />
            <Handle type="source" position={Position.Right} style={{ background: isOrchestrator ? '#ffb700' : '#ff007f', width: '8px', height: '8px' }} />
        </div>
    );
};

const CyberToolNode = ({ data }: any) => {
    const isFailed = data.state === "failed";
    const borderGlowClass = isFailed ? "glow-neon-magenta border-red-500 text-red-500" : data.state === "completed" ? "glow-neon-green border-emerald-400 text-emerald-400" : "glow-neon-orange border-orange-400 text-orange-400";
    const stateColor = isFailed ? "text-red-500 font-bold" : data.state === "completed" ? "text-emerald-500 font-bold" : "text-orange-500 animate-pulse font-bold";

    return (
        <div className={`px-4 py-3 rounded-xl border bg-zinc-950/90 text-xs font-mono glow-class shadow-lg relative min-w-[200px] max-w-[260px] text-left ${borderGlowClass}`}>
            <div className="absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80">
                System Action
            </div>
            <div className="border-b border-zinc-800 pb-1 mb-1.5 flex items-center gap-1.5 select-none">
                <span>⚙️</span> TOOL EXECUTION
            </div>
            <div className="space-y-1">
                <div className="text-[11px] font-bold text-zinc-100 truncate font-mono">
                    {data.tool}
                </div>
                <div className="text-[10px] text-zinc-400 font-medium line-clamp-1 truncate select-text" title={data.title}>
                    {data.title}
                </div>
                <div className="text-[9px] mt-1 pt-1 border-t border-zinc-900 flex justify-between select-none">
                    <span className="text-zinc-500">Status:</span>
                    <span className={stateColor}>{data.state?.toUpperCase()}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#ff5e00', width: '8px', height: '8px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#ff5e00', width: '8px', height: '8px' }} />
        </div>
    );
};

const CyberValidatorNode = ({ data }: any) => {
    const isFailed = data.state === "failed" || data.state === "blocked";
    const borderGlowClass = isFailed ? "glow-neon-magenta border-red-500 text-red-500" : data.state === "passed" ? "glow-neon-green border-emerald-400 text-emerald-400" : "glow-neon-cyan border-cyan-400 text-cyan-400";
    const stateColor = isFailed ? "text-red-500 font-bold animate-pulse" : data.state === "passed" ? "text-emerald-500 font-bold" : "text-cyan-500 animate-pulse font-bold";

    return (
        <div className={`px-4 py-3 rounded-xl border bg-zinc-950/90 text-xs font-mono glow-class shadow-lg relative min-w-[200px] max-w-[260px] text-left ${borderGlowClass}`}>
            <div className="absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80">
                Strict Quality Gate
            </div>
            <div className="border-b border-zinc-800 pb-1 mb-1.5 flex items-center gap-1.5 select-none">
                <span>🛡️</span> {data.name}
            </div>
            <div className="space-y-1">
                <div className="text-[9px] mt-1 pt-1 flex justify-between select-none">
                    <span className="text-zinc-500">Verdict:</span>
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
    cyberValidator: CyberValidatorNode
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
    const [showResponsePanel, setShowResponsePanel] = useState<boolean>(true);

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

    // Tìm và tóm tắt câu trả lời cuối cùng từ AI để hiện panel nổi
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

    // Parse Markdown của Node đang được chọn chi tiết trong Inspector
    const inspectorHtml = useMemo(() => {
        if (!selectedNode || !selectedNode.data.content) return '';
        try {
            return marked.parse(selectedNode.data.content) as string;
        } catch (e) {
            return selectedNode.data.content;
        }
    }, [selectedNode]);

    // 🧬 ĐỒNG BỘ TRẠNG THÁI: Tự động chuyển đổi chuỗi tin nhắn sang Node & Edge khi có thay đổi
    useEffect(() => {
        const nodesList: Node[] = [];
        const edgesList: Edge[] = [];
        let lastNodeId: string | null = null;
        let latestUserNodeId: string | null = null; // Theo dõi prompt người dùng gần nhất để liên kết đầu vào

        // Tọa độ tĩnh của các cột được giãn cách hợp lý tránh va chạm/chồng chéo
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

        // Trợ lý chèn node và kế thừa tọa độ đã kéo thả thực tế từ Ref
        const addNode = (node: Node) => {
            const existingNode = nodesRef.current.find(n => n.id === node.id);
            if (existingNode) {
                node.position = existingNode.position;
            }
            nodesList.push(node);
        };

        messages.forEach((msg: ChatMessage, msgIdx: number) => {
            const isLastMessage = msgIdx === messages.length - 1;
            const isStreaming = isLastMessage && isGenerating;

            // CHỈ VẼ PROMPT DECK NẾU TIN NHẮN ĐÓ LÀ CỦA USER
            if (msg.role === 'user') {
                const userNodeId = `user-${msgIdx}`;
                addNode({
                    id: userNodeId,
                    type: 'cyberUser',
                    data: { content: msg.content, images: msg.images },
                    position: { x: colX.user, y: layerY[0] }
                });

                // Vẽ đường nối tuần tự (Sequence) nối tiếp giữa các phiên hội thoại nếu có
                if (lastNodeId) {
                    edgesList.push({
                        id: `edge-seq-${lastNodeId}-${userNodeId}`,
                        source: lastNodeId,
                        target: userNodeId,
                        animated: false,
                        style: { stroke: '#00f0ff', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.3 }
                    });
                }

                lastNodeId = userNodeId;
                latestUserNodeId = userNodeId;
                layerY[0] += 200;
            }

            // CHỈ DỰNG LUỒNG AGENT VÀ TOOLS NẾU TIN NHẮN LÀ CỦA ASSISTANT
            if (msg.role === 'assistant') {
                const orchNodeId = `orchestrator-${msgIdx}`;
                addNode({
                    id: orchNodeId,
                    type: 'cyberAgent',
                    data: {
                        name: "Master Orchestrator",
                        role: "Lead Technical Architect",
                        model: "System Host",
                        state: isStreaming && (!msg.steps || msg.steps.length === 0) ? 'thinking' : 'completed',
                        content: msg.content
                    },
                    position: { x: colX.orchestrator, y: layerY[1] }
                });

                // Liên kết Orchestrator trực tiếp với Prompt Deck thực tế của người dùng
                if (latestUserNodeId) {
                    edgesList.push({
                        id: `edge-${latestUserNodeId}-${orchNodeId}`,
                        source: latestUserNodeId,
                        target: orchNodeId,
                        animated: isStreaming && (!msg.steps || msg.steps.length === 0),
                        style: { stroke: '#ffb700', strokeWidth: 2, filter: 'drop-shadow(0 0 5px #ffb700)' }
                    });
                }

                lastNodeId = orchNodeId;
                layerY[1] += 220;

                if (msg.steps && msg.steps.length > 0) {
                    const workerNodeId = `worker-${msgIdx}`;
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
                        animated: isStreaming,
                        style: { stroke: '#ff007f', strokeWidth: 2, filter: 'drop-shadow(0 0 5px #ff007f)' }
                    });

                    let lastToolNodeId: string | null = null;

                    msg.steps.forEach((step: ExecutionStep, sIdx: number) => {
                        const stepNodeId = `step-${step.id || `${msgIdx}-${sIdx}`}`;
                        const isLastStep = sIdx === msg.steps!.length - 1;
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
                                animated: isStepRunning,
                                style: { stroke: '#ff007f', strokeWidth: 2, filter: 'drop-shadow(0 0 5px #ff007f)' }
                            });

                            lastToolNodeId = stepNodeId;
                            layerY[2] += 220;
                        } else {
                            // VẼ CÁC SYSTEM ACTION TIÊU CHUẨN
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
                                animated: isStepRunning,
                                style: {
                                    stroke: step.output ? '#39ff14' : '#ff5e00',
                                    strokeWidth: 1.5,
                                    filter: step.output ? 'drop-shadow(0 0 3px #39ff14)' : 'drop-shadow(0 0 3px #ff5e00)'
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
                    const valNodeId = `validator-${msgIdx}`;
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
                        animated: isValRunning,
                        style: {
                            stroke: isValRunning ? '#00f0ff' : isBlocked ? '#ff007f' : '#39ff14',
                            strokeWidth: 2,
                            filter: isValRunning ? 'drop-shadow(0 0 5px #00f0ff)' : isBlocked ? 'drop-shadow(0 0 5px #ff007f)' : 'drop-shadow(0 0 5px #39ff14)'
                        }
                    });

                    lastNodeId = valNodeId;
                    layerY[4] += 180;
                }
            }
        });

        setNodes(nodesList as any);
        setEdges(edgesList as any);
    }, [messages, isGenerating, activeModel, workspaceData, setNodes, setEdges]);

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden relative select-none" style={{ height: '100%', minHeight: '500px' }}>

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
                    className="bg-[#05050c]"
                    proOptions={{ hideAttribution: true }}
                >
                    <Background color="#312e81" gap={16} size={1} />
                    <Controls className="bg-zinc-900 border border-zinc-800 text-zinc-100" />
                    <MiniMap
                        nodeStrokeColor={(n) => {
                            if (n.type === 'cyberUser') return '#00f0ff';
                            if (n.type === 'cyberTool') return '#ff5e00';
                            return '#ffb700';
                        }}
                        nodeColor={(n) => (n.type === 'cyberUser' ? '#00f0ff33' : '#ff5e0033')}
                        className="bg-zinc-900/90 border border-zinc-800"
                    />
                </ReactFlow>

                {/* 🤖 FLOATING LATEST AI RESPONSE OVERLAY PANEL */}
                {lastAssistantMessage && (
                    <div className="absolute top-4 right-4 z-40 flex flex-col items-end pointer-events-none select-none">
                        <button
                            type="button"
                            onClick={() => setShowResponsePanel(!showResponsePanel)}
                            className="bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-800 hover:text-white rounded-lg p-2 text-xs font-semibold cursor-pointer shadow-lg flex items-center gap-1.5 pointer-events-auto"
                        >
                            <span>{showResponsePanel ? '👉' : '👈'}</span> AI Output Panel
                        </button>

                        {showResponsePanel && (
                            <div className="mt-2 bg-zinc-950/95 border border-zinc-800 text-zinc-200 rounded-xl shadow-2xl p-4 overflow-y-auto max-h-[50vh] w-80 md:w-[420px] backdrop-blur-md text-left pointer-events-auto select-text scrollbar-thin">
                                <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono mb-2 pb-1.5 border-b border-zinc-800">
                                    🤖 Latest Assistant Output
                                </h3>
                                <div
                                    className="markdown-body-dark text-[14px] leading-relaxed select-text"
                                    dangerouslySetInnerHTML={{ __html: lastAssistantContentHtml }}
                                />
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
            {pendingPermission && (
                <div className="absolute top-4 left-4 right-4 z-50 max-w-md mx-auto p-4 bg-zinc-900 border border-amber-500 rounded-xl space-y-3 shadow-[0_0_20px_rgba(245,158,11,0.2)] text-left select-text">
                    <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[11px] font-mono">
                        <span className="animate-pulse">⚠️</span> hitl approval required
                    </div>
                    <p className="text-[11px] text-zinc-200 leading-relaxed font-semibold">
                        {pendingPermission.query}
                    </p>
                    {pendingPermission.details && (
                        <pre className="p-2.5 bg-black border border-zinc-800 text-[10px] text-zinc-400 font-mono rounded overflow-auto max-h-24 whitespace-pre-wrap leading-relaxed">
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
                            className="px-2.5 py-1.5 border border-blue-500 bg-blue-950/20 text-blue-400 rounded-lg text-[10px] font-mono font-bold hover:bg-blue-500/20 transition-all cursor-pointer"
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
            )}

            {/* Cyberpunk Inspector Panel (LIGHTBOX MODAL) */}
            <AnimatePresence>
                {selectedNode && (
                    <div
                        className="fixed inset-0 bg-black/85 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 select-text"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setSelectedNode(null);
                        }}
                    >
                        <div
                            className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl h-[80vh] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative"
                            style={{ animation: 'zoomIn 0.2s ease-out', boxShadow: '0 0 30px rgba(0, 240, 255, 0.1)' }}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 bg-zinc-900 border-b border-zinc-800 flex justify-between items-center select-none shrink-0">
                                <div className="text-left">
                                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest font-mono">
                                        🤖 trace node inspector
                                    </h3>
                                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                        Node ID: {selectedNode.id}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedNode(null)}
                                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-xs font-mono font-bold text-zinc-400 hover:text-white cursor-pointer transition-colors"
                                >
                                    CLOSE [Esc]
                                </button>
                            </div>

                            {/* Node Contents Display */}
                            <div className="flex-1 overflow-auto p-6 space-y-5 text-left bg-[#020204]">
                                <div className="flex justify-between items-start flex-wrap gap-2 border-b border-zinc-900 pb-4">
                                    <div>
                                        <h4 className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider mb-0.5">Node Type</h4>
                                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 uppercase">
                                            {selectedNode.type}
                                        </span>
                                    </div>
                                    {selectedNode.data.state && (
                                        <div>
                                            <h4 className="text-[10px] uppercase font-mono font-bold text-zinc-500 tracking-wider mb-0.5">State</h4>
                                            <span className="text-xs font-mono font-bold text-emerald-400">{selectedNode.data.state.toUpperCase()}</span>
                                        </div>
                                    )}
                                </div>

                                {/* USER NODE DETAILS */}
                                {selectedNode.type === 'cyberUser' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <div className="text-xs font-bold text-cyan-500 select-none font-mono">💬 PROMPT CONTENT:</div>
                                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                                                <div
                                                    className="markdown-body-dark text-[14px] leading-relaxed select-text"
                                                    dangerouslySetInnerHTML={{ __html: inspectorHtml }}
                                                />
                                            </div>
                                        </div>
                                        {selectedNode.data.images && selectedNode.data.images.length > 0 && (
                                            <div className="space-y-1.5">
                                                <div className="text-xs font-bold text-cyan-500 select-none font-mono">🖼️ UPLOADED VISUAL DATA:</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedNode.data.images.map((img: string, idx: number) => (
                                                        <img key={idx} src={img} className="max-h-40 rounded border border-zinc-800" alt="visual" />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* AGENT NODE DETAILS */}
                                {selectedNode.type === 'cyberAgent' && (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-zinc-400">
                                            <div>• Name: <span className="text-zinc-200 font-bold">{selectedNode.data.name}</span></div>
                                            <div>• Model: <span className="text-blue-400 font-bold">{selectedNode.data.model}</span></div>
                                            <div>• Role: <span className="text-zinc-200 font-semibold">{selectedNode.data.role}</span></div>
                                        </div>
                                        {selectedNode.data.content && (
                                            <div className="space-y-1">
                                                <div className="text-xs font-bold text-amber-500 select-none font-mono">🧠 THOUGHT PROCESS / RESPONSE:</div>
                                                <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                                                    <div
                                                        className="markdown-body-dark text-[14px] leading-relaxed select-text"
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
                                        <div className="grid grid-cols-2 gap-4 text-xs font-mono text-zinc-400">
                                            <div>• Tool: <span className="text-orange-400 font-bold">{selectedNode.data.tool}</span></div>
                                            <div>• Task Description: <span className="text-zinc-200 font-semibold">{selectedNode.data.title}</span></div>
                                        </div>

                                        {/* RENDER CHI TIẾT FILE NẾU LÀ REPLACE/WRITE */}
                                        {selectedNode.data.tool === 'replace_content_safe' && selectedNode.data.input && (() => {
                                            try {
                                                const parsed = JSON.parse(selectedNode.data.input);
                                                return (
                                                    <div className="space-y-3 pt-3 border-t border-zinc-900">
                                                        <div className="text-xs font-bold text-orange-500 select-none font-mono">📝 FILE MODIFICATION (REPLACE CONTENT SAFE)</div>
                                                        <div className="text-xs text-zinc-400 font-mono">
                                                            • File Path:{" "}
                                                            <button
                                                                type="button"
                                                                onClick={() => onViewDiff && onViewDiff(parsed.file_path)}
                                                                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-2 py-0.5 rounded text-blue-400 font-mono text-xs cursor-pointer select-text"
                                                            >
                                                                📄 {parsed.file_path} (Xem thay đổi 🔍)
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] font-bold text-rose-500 select-none">❌ TARGET CONTENT (DELETED):</div>
                                                                <pre className="p-3 bg-red-950/20 border border-red-900/40 rounded text-xs font-mono text-rose-300 max-h-32 overflow-auto whitespace-pre select-text leading-normal">
                                                                    {parsed.target_content}
                                                                </pre>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] font-bold text-emerald-500 select-none">✅ REPLACEMENT CONTENT (ADDED):</div>
                                                                <pre className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded text-xs font-mono text-emerald-300 max-h-40 overflow-auto whitespace-pre select-text leading-normal">
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
                                                    <div className="space-y-3 pt-3 border-t border-zinc-900">
                                                        <div className="text-xs font-bold text-orange-500 select-none font-mono">💾 CREATE / OVERWRITE (WRITE FILE)</div>
                                                        <div className="text-xs text-zinc-400 font-mono">• File Path: <code className="bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300">{parsed.file_path}</code></div>
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-bold text-teal-400 select-none">📝 FILE CONTENT:</div>
                                                            <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded text-xs font-mono text-zinc-300 max-h-40 overflow-auto whitespace-pre select-text leading-normal">
                                                                {content}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                );
                                            } catch { return null; }
                                        })()}

                                        {/* Standard Tool Inputs */}
                                        {selectedNode.data.input && !['replace_content_safe', 'write_file'].includes(selectedNode.data.tool) && (
                                            <div className="space-y-1.5 pt-3 border-t border-zinc-900">
                                                <div className="text-xs font-bold text-orange-500 select-none font-mono">⚙️ INPUT ARGUMENTS:</div>
                                                <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-blue-400 overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                                                    {selectedNode.data.input}
                                                </pre>
                                            </div>
                                        )}

                                        {/* Tool Output / Result */}
                                        {selectedNode.data.output && (
                                            <div className="space-y-1.5 pt-3 border-t border-zinc-900">
                                                <div className="text-xs font-bold text-emerald-500 select-none font-mono">⚙️ OUTPUT RESPONSE:</div>
                                                <pre className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 overflow-x-auto max-h-52 whitespace-pre select-text leading-normal">
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
                                        <div className="text-xs font-mono text-zinc-400">• Name: <span className="text-zinc-200 font-bold">{selectedNode.data.name}</span></div>
                                        <div className="space-y-1">
                                            <div className="text-xs font-bold text-magenta-500 select-none font-mono">🛡️ VERDICT ANALYSIS:</div>
                                            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-sans text-zinc-200 select-text leading-relaxed whitespace-pre-wrap">
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