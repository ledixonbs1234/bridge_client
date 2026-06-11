// filepath: ridge_client/src/components/terminal/VisualFlow.tsx
import * as React from "react";
import { useState, useMemo, useEffect, useRef } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
    useReactFlow,
    MarkerType
} from "reactflow";
import "reactflow/dist/style.css";
import { useSSE, ChatMessage, TimelineItem } from "../../hooks/useSSE";
import { ChatInputForm } from "./ChatInputForm";
import { WorkspaceData } from "../../App";
import { AnimatePresence } from "motion/react";
import { marked } from "marked";
import { StructuredQuestionsForm } from "./StructuredQuestionsForm";
import { TimelineTextBlock } from "./TimelineTextBlock";

// Nhập khẩu các Custom Nodes chất lượng cao từ thư mục nodes/
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
    onViewDiff
}: VisualFlowProps) {
    const { messages, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration } = sse;

    const [realProviders, setRealProviders] = useState<any[]>([]);
    const [availableCommands, setAvailableCommands] = useState<any[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const { fitView, setCenter, getZoom } = useReactFlow();
    const isFirstLoad = useRef(true);
    const wasGeneratingRef = useRef(false);

    const [viewMode, setViewMode] = useState<'full' | 'active'>(() => {
        try {
            const saved = localStorage.getItem('bridge_flow_view_mode');
            return (saved === 'full' || saved === 'active') ? saved : 'full';
        } catch {
            return 'full';
        }
    });

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        try {
            const saved = localStorage.getItem('bridge_flow_theme');
            return (saved === 'light' || saved === 'dark') ? saved : 'dark';
        } catch {
            return 'dark';
        }
    });

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

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

    const lastAssistantMessage = useMemo(() => {
        return [...messages].reverse().find(m => m.role === 'assistant');
    }, [messages]);

    const inspectorHtml = useMemo(() => {
        if (!selectedNode || !selectedNode.data.content) return '';
        try {
            return marked.parse(selectedNode.data.content) as string;
        } catch (e) {
            return selectedNode.data.content;
        }
    }, [selectedNode]);

    const filteredMessages = useMemo(() => {
        if (viewMode === 'full') return messages;

        const lastUserIdx = [...messages].reverse().findIndex(m => m.role === 'user');
        if (lastUserIdx === -1) return messages;

        const actualIdx = messages.length - 1 - lastUserIdx;
        return messages.slice(actualIdx);
    }, [messages, viewMode]);

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

        const newWidth = Math.max(260, Math.min(900, resizeStart.current.w - deltaX));
        const newHeight = Math.max(150, Math.min(700, resizeStart.current.h + deltaY));

        setPanelWidth(newWidth);
        setPanelHeight(newHeight);
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        resizeStart.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // ĐỒNG BỘ ĐỒ THỊ KHI ĐANG CHẠY THỜI GIAN THỰC
    useEffect(() => {
        if (!workspaceData) return;

        const nodesList: any[] = [];
        const edgesList: any[] = [];

        const currentStepMap = workspaceData.states || [];
        const runningStepKey = workspaceData.activeTask?.step_key || '';

        const harnessNodesConfig = workspaceData.harness_config?.nodes || {
            "planner": { "type": "agent", "next": "coder" },
            "coder": { "type": "agent", "next": "validator" },
            "validator": { "type": "validator", "next_on_success": "end", "next_on_failure": "healer" },
            "healer": { "type": "agent", "next": "coder" }
        };
        const initialNode = workspaceData.harness_config?.initial_node || "planner";

        const layoutNodePositions = (nodesConfig: any, startNode: string) => {
            const positions: Record<string, { x: number; y: number; depth: number }> = {};
            const visited = new Set<string>();
            const queue: Array<{ name: string; depth: number }> = [{ name: startNode, depth: 0 }];

            while (queue.length > 0) {
                const { name, depth } = queue.shift()!;
                if (visited.has(name) || !nodesConfig[name]) continue;
                visited.add(name);

                const siblingCount = Object.values(positions).filter(p => p.depth === depth).length;

                positions[name] = {
                    x: 100 + depth * 320,
                    y: 120 + siblingCount * 220,
                    depth
                };

                const config = nodesConfig[name];
                if (config.next) {
                    queue.push({ name: config.next, depth: depth + 1 });
                }
                if (config.next_on_success) {
                    queue.push({ name: config.next_on_success, depth: depth + 1 });
                }
                if (config.next_on_failure) {
                    queue.push({ name: config.next_on_failure, depth: depth + 1 });
                }
            }

            Object.keys(nodesConfig).forEach((name, idx) => {
                if (!positions[name]) {
                    positions[name] = { x: 100 + idx * 320, y: 450, depth: idx };
                }
            });

            return positions;
        };

        const calculatedPositions = layoutNodePositions(harnessNodesConfig, initialNode);

        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        const userNodeId = 'user-prompt-node';
        if (lastUserMsg) {
            nodesList.push({
                id: userNodeId,
                type: 'cyberUser',
                data: {
                    content: lastUserMsg.content,
                    images: lastUserMsg.images,
                    theme
                },
                position: { x: 50, y: 120 }
            });
        }

        Object.entries(harnessNodesConfig).forEach(([nodeName, nodeVal]: [string, any]) => {
            const position = calculatedPositions[nodeName] || { x: 300, y: 150 };
            const dbState = currentStepMap.find(s => s.step_key === nodeName);
            let stateString = 'idle';

            if (dbState) {
                if (dbState.state === 'RUNNING') stateString = 'running';
                else if (dbState.state === 'VALIDATING') stateString = 'thinking';
                else if (dbState.state === 'DONE') stateString = 'completed';
                else if (dbState.state === 'FAILED' || dbState.state === 'BLOCKED') stateString = 'failed';
            }

            const isValidator = nodeVal.type === 'validator';

            nodesList.push({
                id: nodeName,
                type: isValidator ? 'cyberValidator' : 'cyberAgent',
                data: {
                    theme,
                    name: nodeName.toUpperCase(),
                    role: isValidator ? "Strict Quality Gate" : "Specialist Worker Node",
                    model: workspaceData.provider.model || "Local Engine",
                    state: stateString,
                    content: dbState ? dbState.summary : ""
                },
                position: {
                    x: lastUserMsg ? position.x + 300 : position.x,
                    y: position.y
                }
            });
        });

        if (lastUserMsg) {
            edgesList.push({
                id: `edge-user-to-entry`,
                source: userNodeId,
                target: initialNode,
                type: 'smoothstep',
                animated: runningStepKey === initialNode,
                style: {
                    stroke: theme === 'dark' ? '#00f0ff' : '#0ea5e9',
                    strokeWidth: 2,
                    filter: theme === 'dark' ? 'drop-shadow(0 0 5px #00f0ff)' : undefined
                }
            });
        }

        // STEP 1: UPGRADED EDGE ROUTING VISUALIZATION IN REAL-TIME
        Object.entries(harnessNodesConfig).forEach(([nodeName, nodeVal]: [string, any]) => {
            const dbSourceState = currentStepMap.find(s => s.step_key === nodeName);

            const addEdgeHelper = (targetNodeName: string, pathType: "success" | "failure" | "default" = "default") => {
                const dbTargetState = currentStepMap.find(s => s.step_key === targetNodeName);
                const isEdgeActive = (dbSourceState?.state === 'DONE' && dbTargetState?.state === 'RUNNING') ||
                    (dbSourceState?.state === 'RUNNING' && runningStepKey === targetNodeName);

                // Thiết lập kiểu dáng dây nối rực rỡ bám sát theo nhãn và trạng thái chạy Live
                let strokeColor = theme === 'dark' ? '#27272a' : '#d4d4d8';
                let strokeDash = undefined;
                let label = "";

                if (pathType === "success") {
                    strokeColor = '#10b981'; // Emerald
                    strokeDash = "4,4";
                    label = "✓ Success";
                } else if (pathType === "failure") {
                    strokeColor = '#ef4444'; // Rose
                    strokeDash = "4,4";
                    label = "✗ Failure";
                } else if (isEdgeActive) {
                    strokeColor = theme === 'dark' ? '#ff007f' : '#c026d3';
                }

                edgesList.push({
                    id: `edge-flow-${nodeName}-${targetNodeName}`,
                    source: nodeName,
                    target: targetNodeName,
                    type: 'smoothstep',
                    animated: isEdgeActive,
                    label,
                    labelStyle: { fill: strokeColor, fontWeight: 700, fontSize: 8 },
                    labelBgStyle: { fill: theme === 'dark' ? '#05050c' : '#ffffff', fillOpacity: 0.85, rx: 4 },
                    style: {
                        stroke: strokeColor,
                        strokeWidth: isEdgeActive ? 2.5 : 1.5,
                        strokeDasharray: strokeDash,
                        filter: (isEdgeActive && theme === 'dark') ? `drop-shadow(0 0 4px ${strokeColor})` : undefined
                    },
                    markerEnd: { type: MarkerType.ArrowClosed }
                });
            };

            if (nodeVal.next) addEdgeHelper(nodeVal.next);
            if (nodeVal.next_on_success) addEdgeHelper(nodeVal.next_on_success, "success");
            if (nodeVal.next_on_failure) addEdgeHelper(nodeVal.next_on_failure, "failure");
        });

        if (workspaceData.activeTask && runningStepKey) {
            const toolNodeId = `active-system-tool-node`;
            const parentPosition = calculatedPositions[runningStepKey] || { x: 300, y: 150 };
            const correctParentX = lastUserMsg ? parentPosition.x + 300 : parentPosition.x;

            nodesList.push({
                id: toolNodeId,
                type: 'cyberTool',
                data: {
                    theme,
                    tool: workspaceData.activeTask.tool || "SYSTEM ACTION",
                    title: workspaceData.activeTask.description || "Đang thực thi lệnh hệ thống...",
                    state: "running"
                },
                position: { x: correctParentX, y: parentPosition.y + 220 }
            });

            edgesList.push({
                id: `edge-agent-to-tool`,
                source: runningStepKey,
                target: toolNodeId,
                type: 'smoothstep',
                animated: true,
                style: {
                    stroke: '#ff5e00',
                    strokeWidth: 2,
                    filter: theme === 'dark' ? 'drop-shadow(0 0 4px #ff5e00)' : undefined
                }
            });
        }

        setNodes(nodesList);
        setEdges(edgesList);

    }, [messages, isGenerating, workspaceData, setNodes, setEdges, theme, viewMode]);

    useEffect(() => {
        if (nodes.length > 0 && isFirstLoad.current) {
            const timer = setTimeout(() => {
                fitView({ padding: 0.15, duration: 800 });
                isFirstLoad.current = false;
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [nodes.length, fitView]);

    useEffect(() => {
        if (isGenerating && !wasGeneratingRef.current && nodes.length > 0) {
            const activeNode = nodes.find((n) =>
                n.data?.state === 'running' || n.data?.state === 'thinking' || n.data?.state === 'validating'
            ) || nodes[nodes.length - 1];

            if (activeNode) {
                const { x, y } = activeNode.position;
                const currentZoom = getZoom() || 0.85;
                setCenter(x + 100, y + 180, { zoom: currentZoom, duration: 800 });
            }
        }
        wasGeneratingRef.current = isGenerating;
    }, [isGenerating, nodes, setCenter, getZoom]);

    return (
        <div className={`flex-1 flex flex-col h-full overflow-hidden relative select-none transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-100 text-zinc-800'}`} style={{ height: '100%', minHeight: '500px' }}>

            <div className="flex-1 h-full w-full relative" style={{ height: '100%' }}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, node) => setSelectedNode(node)}
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
                                <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 select-text">
                                    <TimelineTextBlock content={lastAssistantMessage.content} theme={theme} />
                                </div>

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

                if (structuredQuestions) {
                    return (
                        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs select-text">
                            <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-xl shadow-2xl p-6 relative overflow-hidden text-zinc-800 flex flex-col text-left" style={{ animation: 'zoomIn 0.18s ease-out' }}>
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-amber-500" />
                                <div className="flex items-center gap-1.5 text-blue-600 font-bold text-[11px] font-mono select-none mb-3">
                                    <span className="animate-pulse">❓</span> YÊU CẦU LÀM RÕ THÔNG TIN (STRUCTURED WIZARD)
                                </div>
                                <div className="overflow-y-auto max-h-[70vh] pr-1">
                                    <StructuredQuestionsForm
                                        data={structuredQuestions}
                                        onSubmit={(ans) => {
                                            respondToPermission(pendingPermission.id, JSON.stringify(ans));
                                        }}
                                        onCancel={() => respondToPermission(pendingPermission.id, 'n')}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs select-text">
                        <div className="bg-zinc-900 border border-amber-500 rounded-2xl p-6 space-y-4 shadow-2xl text-left max-w-md w-full relative" style={{ animation: 'zoomIn 0.18s ease-out' }}>
                            <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[11px] font-mono select-none">
                                <span className="animate-pulse">⚠️</span> hitl approval required
                            </div>
                            <p className="text-xs text-zinc-200 leading-relaxed font-semibold">
                                {pendingPermission.query}
                            </p>
                            {pendingPermission.details && (
                                <pre className="p-3 bg-black border border-zinc-800 text-[10px] text-zinc-400 font-mono rounded overflow-auto max-h-40 whitespace-pre-wrap">
                                    {pendingPermission.details}
                                </pre>
                            )}
                            <div className="flex gap-1.5 justify-end pt-1">
                                <button
                                    onClick={() => respondToPermission(pendingPermission.id, 'n')}
                                    className="px-3.5 py-1.5 border border-red-500 bg-red-950/20 text-red-500 rounded-lg text-[10px] font-mono font-bold hover:bg-red-500/20 transition-all cursor-pointer"
                                >
                                    DENY
                                </button>
                                <button
                                    onClick={() => respondToPermission(pendingPermission.id, 'y')}
                                    className="px-3.5 py-1.5 border border-blue-500 bg-blue-950/20 text-blue-400 rounded-lg text-[10px] font-mono font-bold hover:bg-blue-50/20 transition-all cursor-pointer"
                                >
                                    APPROVE (YES)
                                </button>
                                <button
                                    onClick={() => respondToPermission(pendingPermission.id, 'a')}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer"
                                >
                                    APPROVE ALL
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

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

                                {selectedNode.type === 'cyberUser' && (
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-cyan-500' : 'text-cyan-600'}`}>💬 PROMPT CONTENT:</div>
                                            <div className={`p-4 border rounded-xl transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                                                }`}>
                                                <TimelineTextBlock content={selectedNode.data.content} theme={theme} />
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

                                {selectedNode.type === 'cyberAgent' && (
                                    <div className="space-y-4">
                                        <div className={`grid grid-cols-2 gap-4 text-xs font-mono transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-655'
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

                                {selectedNode.type === 'cyberTool' && (
                                    <div className="space-y-4">
                                        <div className={`grid grid-cols-2 gap-4 text-xs font-mono transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-655'
                                            }`}>
                                            <div>• Tool: <span className="font-bold" style={{ color: theme === 'dark' ? '#f97316' : '#ea580c' }}>{selectedNode.data.tool}</span></div>
                                            <div>• Task Description: <span className="font-semibold" style={{ color: theme === 'dark' ? '#fff' : '#18181b' }}>{selectedNode.data.title}</span></div>
                                        </div>

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

                                        {(() => {
                                            let structuredQuestions = null;
                                            if (selectedNode.data.input && typeof selectedNode.data.input === 'string' && selectedNode.data.input.trim().startsWith('{')) {
                                                try {
                                                    const parsed = JSON.parse(selectedNode.data.input);
                                                    if (parsed.questions || parsed.explanation) {
                                                        structuredQuestions = parsed;
                                                    }
                                                } catch { }
                                            }

                                            if (structuredQuestions) {
                                                return (
                                                    <div className={`space-y-3 pt-3 border-t ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
                                                        <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>
                                                            ❓ INTERACTIVE STRUCTURED WIZARD
                                                        </div>
                                                        <div className={`p-4 border rounded-xl transition-colors duration-200 ${theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800 text-zinc-200' : 'bg-blue-50/30 border-blue-150 text-zinc-800'
                                                            }`}>
                                                            {pendingPermission ? (
                                                                <StructuredQuestionsForm
                                                                    data={structuredQuestions}
                                                                    onSubmit={(ans) => {
                                                                        respondToPermission(pendingPermission.id, JSON.stringify(ans));
                                                                        setSelectedNode(null);
                                                                    }}
                                                                    onCancel={() => {
                                                                        respondToPermission(pendingPermission.id, 'n');
                                                                        setSelectedNode(null);
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    <div className={`border rounded-xl p-3 ${theme === 'dark' ? 'bg-blue-950/20 border-blue-900/50' : 'bg-blue-50/50 border-blue-100'
                                                                        }`}>
                                                                        <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-0.5">💡 EXPLANATION</span>
                                                                        <p className={`text-[11px] leading-relaxed font-semibold ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>{structuredQuestions.explanation}</p>
                                                                    </div>
                                                                    <div className="space-y-3">
                                                                        {Array.isArray(structuredQuestions.questions) && structuredQuestions.questions.map((q: any, qIdx: number) => (
                                                                            <div key={q.id || qIdx} className={`border-b pb-2 last:border-b-0 ${theme === 'dark' ? 'border-zinc-800' : 'border-zinc-150/40'}`}>
                                                                                <div className={`text-[11px] font-bold ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-850'}`}>
                                                                                    <span className="text-blue-600 font-extrabold mr-1.5">{qIdx + 1}.</span>
                                                                                    {q.question}
                                                                                </div>
                                                                                <div className="mt-1 text-[10px] text-zinc-500 font-mono">
                                                                                    Type: <span className="text-blue-500 font-bold">{q.type}</span>
                                                                                </div>
                                                                                {q.options && (
                                                                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                                                                        {q.options.map((opt: any, optIdx: number) => (
                                                                                            <span key={optIdx} className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-100 border-zinc-200 text-zinc-600'
                                                                                                }`}>
                                                                                                {opt.label} {opt.is_default && '★'}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                selectedNode.data.input && !['replace_content_safe', 'write_file'].includes(selectedNode.data.tool) && (
                                                    <div className={`space-y-1.5 pt-3 border-t ${theme === 'dark' ? 'border-zinc-900' : 'border-zinc-200'}`}>
                                                        <div className={`text-xs font-bold select-none font-mono ${theme === 'dark' ? 'text-orange-500' : 'text-orange-600'}`}>⚙️ INPUT ARGUMENTS:</div>
                                                        <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap select-text leading-relaxed transition-colors ${theme === 'dark'
                                                            ? 'bg-zinc-900 border-zinc-800 text-blue-400'
                                                            : 'bg-zinc-50 border-zinc-200 text-blue-600'
                                                            }`}>
                                                            {selectedNode.data.input}
                                                        </pre>
                                                    </div>
                                                )
                                            );
                                        })()}

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

                                {selectedNode.type === 'cyberValidator' && (
                                    <div className="space-y-4">
                                        <div className={`text-xs font-mono transition-colors ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-655'}`}>• Name: <span className="font-bold" style={{ color: theme === 'dark' ? '#fff' : '#18181b' }}>{selectedNode.data.name}</span></div>
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