// filepath: bridge_client/src/components/terminal/VisualFlow.tsx
import * as React from "react";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { StructuredQuestionsForm } from "./StructuredQuestionsForm";
// Nhập khẩu các custom nodes chất lượng cao
import {
    CyberGroupNode,
    CyberUserNode,
    CyberAgentNode,
    CyberToolNode,
    CyberValidatorNode,
    CyberEndNode
} from "../nodes";



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

    const nodeTypes = useMemo(() => ({
        cyberUser: CyberUserNode,
        cyberAgent: CyberAgentNode,
        cyberTool: CyberToolNode,
        cyberValidator: CyberValidatorNode,
        cyberGroup: CyberGroupNode,
        cyberEnd: CyberEndNode
    }), []);
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
    // Bắt log khi React Flow tự động xóa node
    const handleNodesChange = useCallback((changes: any) => {
        const removals = changes.filter((c: any) => c.type === 'remove');
        if (removals.length > 0) {
            console.warn("🚨 [VisualFlow Debug] ReactFlow đang tự động XÓA nodes:", removals);
        }
        onNodesChange(changes);
    }, [onNodesChange]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const structuredQuestions = useMemo(() => {
        if (!pendingPermission?.details) return null;
        try {
            const parsed = JSON.parse(pendingPermission.details);
            if (parsed && parsed.type === 'structured_questions') {
                return parsed;
            }
        } catch { }
        return null;
    }, [pendingPermission]);
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
        console.log("🔍 [VisualFlow Sync] Triggered. workspaceData có không?", !!workspaceData);

        if (!workspaceData) {
            console.log("⚠️ [VisualFlow Sync] Bỏ qua vì workspaceData null/undefined");
            return;
        }

        const harnessNodesConfig = workspaceData.harness_config?.nodes || {};
        const nodeKeys = Object.keys(harnessNodesConfig);

        if (nodeKeys.length === 0) {
            console.error("🚨 [VisualFlow Sync] LỖI: Backend trả về harness_config.nodes RỖNG!");
        }

        const nodesList: any[] = [];
        const edgesList: any[] = [];

        const currentStepMap = workspaceData.states || [];
        const runningStepKey = workspaceData.activeTask?.step_key || "";
        // const harnessNodesConfig = workspaceData.harness_config?.nodes || {};
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

        // 🧠 THUẬT TOÁN MỚI: Mổ xẻ và chia tách timeline cho từng Node dựa trên System Event Markers
        const nodeMessagesMap = new Map<string, any[]>();
        const nodeUsageMap = new Map<string, any>();
        let currentNodeContext = initialNode.toLowerCase();
        let tempUserContent = "";

        messages.forEach((msg, idxIdx) => {
            if (msg.role === "user") {
                tempUserContent = msg.content;
            } else if (msg.role === "assistant") {
                const timeline = msg.timeline || (msg.steps && msg.steps.length > 0 ? [{ id: `rec-${idxIdx}`, type: "steps", steps: msg.steps }] : []);

                let currentTurnAccumulator: any[] = [];
                let localNodeContext = currentNodeContext;

                // Cắt timeline ra thành từng mảnh khi gặp cờ báo hiệu chuyển Node
                timeline.forEach((item: any) => {
                    if (item.type === 'text') {
                        const match = item.content?.match(/(?:Bắt đầu kích hoạt Node:|Đang tự động kích hoạt kiểm duyệt cú pháp:)\s*\[(.*?)\]/i);
                        if (match) {
                            // Phát hiện chuyển Node -> Ghi lại mảng tích lũy cũ vào node cũ
                            if (currentTurnAccumulator.length > 0) {
                                const turns = nodeMessagesMap.get(localNodeContext) || [];
                                const lastTurn = turns[turns.length - 1];
                                if (lastTurn && lastTurn.query === tempUserContent) {
                                    lastTurn.accumulator.push(...mapLiveTimelineToAccumulator(currentTurnAccumulator));
                                } else {
                                    turns.push({
                                        query: tempUserContent || "(Không có prompt)",
                                        accumulator: mapLiveTimelineToAccumulator(currentTurnAccumulator)
                                    });
                                }
                                nodeMessagesMap.set(localNodeContext, turns);
                                currentTurnAccumulator = []; // Reset bộ đệm cho node mới
                            }
                            localNodeContext = match[1].toLowerCase();
                            currentNodeContext = localNodeContext; // Cập nhật context theo luồng thời gian
                        }
                    }
                    currentTurnAccumulator.push(item);
                });

                // Đẩy bộ đệm còn sót lại cuối cùng vào Node hiện hành
                if (currentTurnAccumulator.length > 0) {
                    const turns = nodeMessagesMap.get(localNodeContext) || [];
                    const lastTurn = turns[turns.length - 1];
                    if (lastTurn && lastTurn.query === tempUserContent) {
                        lastTurn.accumulator.push(...mapLiveTimelineToAccumulator(currentTurnAccumulator));
                    } else {
                        turns.push({
                            query: tempUserContent || "(Không có prompt)",
                            accumulator: mapLiveTimelineToAccumulator(currentTurnAccumulator)
                        });
                    }
                    nodeMessagesMap.set(localNodeContext, turns);
                }

                if (msg.usage) {
                    nodeUsageMap.set(localNodeContext, msg.usage);
                }
            }
        });

        // Áp dụng dữ liệu đã chia tách vào từng Node trên sơ đồ
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

            const lowerNodeName = nodeName.toLowerCase();
            const mappedTurns = nodeMessagesMap.get(lowerNodeName) ? [...nodeMessagesMap.get(lowerNodeName)!] : [];

            if (mappedTurns.length > 0) {
                // Đảm bảo bám sát các câu lệnh của người dùng đang chat dở dang chưa có Assistant phản hồi
                if (nodeName === activeNodeName && messages[messages.length - 1]?.role === "user") {
                    mappedTurns.push({
                        query: messages[messages.length - 1].content,
                        accumulator: []
                    });
                }
                content = JSON.stringify(mappedTurns);
            } else if (nodeName === activeNodeName && messages.length > 0 && messages[messages.length - 1]?.role === "user") {
                content = JSON.stringify([{
                    query: messages[messages.length - 1].content,
                    accumulator: []
                }]);
            }

            // Gắn Tokens Usage chính xác theo từng node
            const activeAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
            let nodeUsage = nodeUsageMap.get(lowerNodeName);
            if (nodeName === activeNodeName && !nodeUsage) {
                nodeUsage = activeAssistantMsg?.usage || null;
            }

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
                    usage: nodeUsage
                },
                position: {
                    x: lastUserMsg ? 100 + idx * 320 + 300 : 100 + idx * 320,
                    y: 120
                }
            });
        });

        // Helper lấy trạng thái chạy động của từng node phục vụ tô màu đường nối
        const getNodeState = (nodeId: string) => {
            const dbState = currentStepMap.find(s => s.step_key === nodeId);
            if (!dbState) return "PENDING";
            return dbState.state; // "PENDING" | "QUEUED" | "RUNNING" | "VALIDATING" | "DONE" | "FAILED" | "BLOCKED"
        };

        const initialNodeState = getNodeState(initialNode);

        if (lastUserMsg) {
            edgesList.push({
                id: `edge-user-to-entry`,
                source: userNodeId,
                target: initialNode,
                type: "smoothstep",
                animated: runningStepKey === initialNode || initialNodeState === "RUNNING" || initialNodeState === "VALIDATING",
                style: {
                    stroke: (initialNodeState === "RUNNING" || initialNodeState === "VALIDATING")
                        ? (theme === "dark" ? "#00f0ff" : "#0ea5e9")
                        : (theme === "dark" ? "#3f3f46" : "#cbd5e1"),
                    strokeWidth: (initialNodeState === "RUNNING" || initialNodeState === "VALIDATING") ? 2.5 : 1.5
                }
            });
        }

        // 1. Vẽ các cạnh tuần tự tĩnh của luồng lập trình mềm (Programmatic next)
        Object.entries(harnessNodesConfig).forEach(([nodeName, nodeVal]: [string, any]) => {
            const addEdgeHelper = (targetNodeName: string) => {
                const sourceState = getNodeState(nodeName);
                const targetState = getNodeState(targetNodeName);

                let strokeColor = theme === "dark" ? "#27272a" : "#e4e4e7";
                let strokeWidth = 1.5;
                let isAnimated = false;
                let strokeDasharray = undefined;

                if (sourceState === "DONE" && targetState === "DONE") {
                    strokeColor = theme === "dark" ? "#10b981" : "#059669"; // Màu xanh lá cây hoàn thành
                    strokeWidth = 2;
                } else if (sourceState === "DONE" && (targetState === "RUNNING" || targetState === "VALIDATING")) {
                    strokeColor = theme === "dark" ? "#00f0ff" : "#0ea5e9"; // Đang chuyển giao, chạy động sáng
                    strokeWidth = 2.5;
                    isAnimated = true;
                } else if ((sourceState === "RUNNING" || sourceState === "VALIDATING") && targetState === "PENDING") {
                    strokeColor = theme === "dark" ? "#6366f1" : "#4f46e5"; // Đang chuẩn bị chuyển tiếp
                    strokeWidth = 1.5;
                    isAnimated = true;
                    strokeDasharray = "5,5";
                }

                edgesList.push({
                    id: `edge-flow-${nodeName}-${targetNodeName}`,
                    source: nodeName,
                    target: targetNodeName,
                    type: "smoothstep",
                    animated: isAnimated,
                    style: {
                        stroke: strokeColor,
                        strokeWidth: strokeWidth,
                        strokeDasharray: strokeDasharray
                    },
                    markerEnd: { type: MarkerType.ArrowClosed }
                });
            };
            if (nodeVal.next) addEdgeHelper(nodeVal.next);
        });

        // 2. Vẽ các cạnh tuần tự tĩnh (edges) được lưu từ Graph Builder
        if (Array.isArray(workspaceData?.harness_config?.edges)) {
            workspaceData.harness_config.edges.forEach((edge: any) => {
                const sourceState = getNodeState(edge.from);
                const targetState = getNodeState(edge.to);

                let strokeColor = theme === "dark" ? "#27272a" : "#e4e4e7";
                let strokeWidth = 1.5;
                let isAnimated = false;
                let strokeDasharray = undefined;

                if (sourceState === "DONE" && targetState === "DONE") {
                    strokeColor = theme === "dark" ? "#10b981" : "#059669"; // Màu xanh lá cây hoàn thành
                    strokeWidth = 2;
                } else if (sourceState === "DONE" && (targetState === "RUNNING" || targetState === "VALIDATING")) {
                    strokeColor = theme === "dark" ? "#00f0ff" : "#0ea5e9"; // Đang chuyển giao dở dang
                    strokeWidth = 2.5;
                    isAnimated = true;
                } else if ((sourceState === "RUNNING" || sourceState === "VALIDATING") && targetState === "PENDING") {
                    strokeColor = theme === "dark" ? "#6366f1" : "#4f46e5"; // Sắp chuyển giao
                    strokeWidth = 1.5;
                    isAnimated = true;
                    strokeDasharray = "5,5";
                }

                edgesList.push({
                    id: `edge-flow-${edge.from}-${edge.to}`,
                    source: edge.from,
                    target: edge.to,
                    type: "smoothstep",
                    animated: isAnimated,
                    style: {
                        stroke: strokeColor,
                        strokeWidth: strokeWidth,
                        strokeDasharray: strokeDasharray
                    },
                    markerEnd: { type: MarkerType.ArrowClosed }
                });
            });
        }

        // 3. Vẽ các cạnh rẽ nhánh điều kiện (conditional_edges) rực rỡ và thay đổi trạng thái thông minh
        if (Array.isArray(workspaceData?.harness_config?.conditional_edges)) {
            workspaceData.harness_config.conditional_edges.forEach((ce: any) => {
                if (ce.router) {
                    const sourceState = getNodeState(ce.from);

                    if (ce.router.is_empty) {
                        // ĐƯỜNG DẪN THÀNH CÔNG (SUCCESS PATH)
                        const targetState = getNodeState(ce.router.is_empty);
                        let strokeColor = theme === "dark" ? "#27272a" : "#e4e4e7"; // Mờ đi khi chưa chạy hoặc rẽ sang hướng khác
                        let isAnimated = false;
                        let strokeWidth = 1.5;

                        if (sourceState === "DONE") {
                            // Thành công! Tô màu xanh rực rỡ
                            strokeColor = "#10b981";
                            strokeWidth = 2.5;
                            isAnimated = targetState === "RUNNING" || targetState === "VALIDATING";
                        } else if (sourceState === "VALIDATING" || sourceState === "RUNNING") {
                            strokeColor = theme === "dark" ? "#3f3f46" : "#a1a1aa";
                        }

                        edgesList.push({
                            id: `edge-flow-cond-success-${ce.from}-${ce.router.is_empty}`,
                            source: ce.from,
                            target: ce.router.is_empty,
                            type: "smoothstep",
                            label: "✓ Success",
                            animated: isAnimated,
                            style: {
                                stroke: strokeColor,
                                strokeWidth: strokeWidth,
                                strokeDasharray: sourceState === "DONE" ? undefined : '4,4'
                            },
                            labelStyle: {
                                fill: sourceState === "DONE" ? '#10b981' : (theme === "dark" ? "#71717a" : "#a1a1aa"),
                                fontWeight: 700,
                                fontSize: 9
                            },
                            labelBgStyle: {
                                fill: theme === "dark" ? '#05050c' : '#f0fdf4',
                                fillOpacity: 0.9,
                                stroke: sourceState === "DONE" ? '#10b981' : (theme === "dark" ? "#27272a" : "#e4e4e7"),
                                strokeWidth: 1,
                                rx: 4
                            },
                            markerEnd: { type: MarkerType.ArrowClosed }
                        });
                    }

                    if (ce.router.is_not_empty) {
                        // ĐƯỜNG DẪN THẤT BẠI (FAILURE PATH)
                        let strokeColor = theme === "dark" ? "#27272a" : "#e4e4e7"; // Mờ đi khi chưa chạy hoặc rẽ sang hướng khác
                        let isAnimated = false;
                        let strokeWidth = 1.5;

                        if (sourceState === "FAILED" || sourceState === "BLOCKED") {
                            // Lỗi xảy ra! Tô màu đỏ pulsing nổi bật
                            strokeColor = "#ef4444";
                            strokeWidth = 2.5;
                            isAnimated = true;
                        } else if (sourceState === "VALIDATING" || sourceState === "RUNNING") {
                            strokeColor = theme === "dark" ? "#451a1a" : "#fca5a5";
                        }

                        edgesList.push({
                            id: `edge-flow-cond-failure-${ce.from}-${ce.router.is_not_empty}`,
                            source: ce.from,
                            target: ce.router.is_not_empty,
                            type: "smoothstep",
                            label: "✗ Failure",
                            animated: isAnimated,
                            style: {
                                stroke: strokeColor,
                                strokeWidth: strokeWidth,
                                strokeDasharray: (sourceState === "FAILED" || sourceState === "BLOCKED") ? undefined : '4,4'
                            },
                            labelStyle: {
                                fill: (sourceState === "FAILED" || sourceState === "BLOCKED") ? '#ef4444' : (theme === "dark" ? "#71717a" : "#a1a1aa"),
                                fontWeight: 700,
                                fontSize: 9
                            },
                            labelBgStyle: {
                                fill: theme === "dark" ? '#05050c' : '#fef2f2',
                                fillOpacity: 0.9,
                                stroke: (sourceState === "FAILED" || sourceState === "BLOCKED") ? '#ef4444' : (theme === "dark" ? "#27272a" : "#e4e4e7"),
                                strokeWidth: 1,
                                rx: 4
                            },
                            markerEnd: { type: MarkerType.ArrowClosed }
                        });
                    }
                }
            });
        }

        // 1. CẬP NHẬT TỪNG PHẦN CHO NODES (Partial Update)
        setNodes((prevNodes) => {
            // Nếu cấu trúc đồ thị thay đổi (thêm/bớt node), buộc phải render lại mảng mới
            if (prevNodes.length === 0 || prevNodes.length !== nodesList.length) {
                return nodesList;
            }

            let hasChanges = false;
            const nextNodes = prevNodes.map(oldNode => {
                const newNode = nodesList.find(n => n.id === oldNode.id);
                if (!newNode) return oldNode;

                // Chỉ so sánh data của riêng Node này
                if (JSON.stringify(oldNode.data) !== JSON.stringify(newNode.data)) {
                    hasChanges = true;
                    console.log(`✅[VisualFlow Sync] Cập nhật Node mới `);
                    // CHỈ tạo object mới cho Node bị thay đổi (giúp React biết để render lại Node này)
                    return { ...oldNode, data: newNode.data };
                }

                // TRẢ VỀ ĐÚNG ĐỊA CHỈ BỘ NHỚ CŨ -> React.memo sẽ BỎ QUA, KHÔNG RENDER LẠI NODE NÀY
                return oldNode;
            });

            // Nếu không có Node nào thay đổi data, chặn toàn bộ đợt render
            return hasChanges ? nextNodes : prevNodes;
        });

        // 2. CẬP NHẬT TỪNG PHẦN CHO EDGES (Partial Update)
        setEdges((prevEdges) => {
            if (prevEdges.length === 0 || prevEdges.length !== edgesList.length) {
                return edgesList;
            }

            let hasChanges = false;
            const nextEdges = prevEdges.map(oldEdge => {
                const newEdge = edgesList.find(e => e.id === oldEdge.id);
                if (!newEdge) return oldEdge;

                // Chỉ kiểm tra hiệu ứng chạy (animated) và màu sắc (style)
                if (oldEdge.animated !== newEdge.animated ||
                    JSON.stringify(oldEdge.style) !== JSON.stringify(newEdge.style)) {
                    hasChanges = true;
                    console.log(`✅[VisualFlow Sync] Cập nhật Egle mới `);
                    // Chỉ cập nhật Edge bị đổi màu hoặc đổi trạng thái chạy
                    return { ...oldEdge, animated: newEdge.animated, style: newEdge.style };
                }

                return oldEdge;
            });

            return hasChanges ? nextEdges : prevEdges;
        });

    }, [messages, isGenerating, workspaceData, setNodes, setEdges, theme]);

    // Tự động căn chỉnh tối ưu toàn màn hình (fitView) khi có thay đổi cấu trúc sơ đồ
    const nodeStructureKey = useMemo(() => {
        return `${nodes.length}-${nodes.map(n => n.id).join(",")}`;
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
                    onNodesChange={handleNodesChange}
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
                        onSendMessage={(prompt, useRefMode, useHeadless, images, mode, selectedModel, useGitIsolation, useGitFooter) => {
                            setSelectedNode(null);
                            sendPrompt(prompt, useRefMode, images, activeAgent, selectedModel || activeModel, useHeadless, mode, useGitIsolation, useGitFooter);
                        }}
                    />
                </div>
            </div>

            {/* Structured HITL Approval Overlay */}
            {pendingPermission && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs select-text">
                    {structuredQuestions ? (
                        <div className={`border rounded-2xl p-6 space-y-4 shadow-2xl text-left max-w-lg w-full relative ${isDark
                            ? 'bg-zinc-950 border-blue-500/80 text-zinc-100'
                            : 'bg-white border-blue-500 text-zinc-800'
                            }`} style={{ animation: "zoomIn 0.18s ease-out" }}>
                            <div className={`flex items-center gap-1.5 font-bold text-[11px] font-mono select-none ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                <span className="animate-pulse">❓</span> clarify requirements form
                            </div>
                            <StructuredQuestionsForm
                                key={pendingPermission.id}
                                data={structuredQuestions}
                                onSubmit={(answers) => respondToPermission(pendingPermission.id, JSON.stringify(answers))}
                                onCancel={() => respondToPermission(pendingPermission.id, "n")}
                                theme={theme}
                            />
                        </div>
                    ) : (
                        <div className={`border rounded-2xl p-6 space-y-4 shadow-2xl text-left max-w-md w-full relative ${isDark
                            ? 'bg-zinc-950 border-amber-500/80 text-zinc-100'
                            : 'bg-white border-amber-500 text-zinc-800'
                            }`} style={{ animation: "zoomIn 0.18s ease-out" }}>
                            <div className={`flex items-center gap-1.5 font-bold text-[11px] font-mono select-none ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>
                                <span className="animate-pulse">⚠️</span> hitl approval required
                            </div>
                            <p className={`text-xs leading-relaxed font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-650'}`}>
                                {pendingPermission.query}
                            </p>
                            <div className="flex gap-1.5 justify-end pt-1">
                                <button
                                    onClick={() => respondToPermission(pendingPermission.id, "n")}
                                    className={`px-3.5 py-1.5 border rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${isDark
                                        ? 'border-red-900/60 bg-red-950/20 text-red-400 hover:bg-red-950/40'
                                        : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                                        }`}
                                >
                                    DENY
                                </button>
                                <button
                                    onClick={() => respondToPermission(pendingPermission.id, "y")}
                                    className={`px-3.5 py-1.5 border rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${isDark
                                        ? 'border-blue-900/60 bg-blue-950/20 text-blue-400 hover:bg-blue-950/40'
                                        : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        }`}
                                >
                                    APPROVE
                                </button>
                                <button
                                    onClick={() => respondToPermission(pendingPermission.id, "a")}
                                    className={`px-3.5 py-1.5 border rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${isDark
                                        ? 'border-purple-900/60 bg-purple-950/20 text-purple-400 hover:bg-purple-950/40'
                                        : 'border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100'
                                        }`}
                                >
                                    APPROVE ALL
                                </button>
                            </div>
                        </div>
                    )}
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
                isGenerating={isGenerating}
            />
        </div>
    );
}