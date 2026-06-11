// filepath: ridge_client/src/components/GraphBuilder.tsx
import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    MarkerType,
    Handle,
    Position
} from "reactflow";
import "reactflow/dist/style.css";
import { Button } from "./animate-ui/button";

interface SkillItem {
    name: string;
    desc: string;
}

interface EditableNodeData {
    name: string;
    type: "agent" | "validator";
    system_prompt: string;
    tools: string[];
    model_mode: "fast" | "thinking";
    target_file_key?: string;
    next_on_success?: string;
    next_on_failure?: string;
}

// KHAI BÁO TƯỜNG MINH ĐỂ SỬA TRIỆT ĐỂ LỖI ts(2304)
interface GraphBuilderProps {
    onSaveSuccess?: () => void;
    editConfig?: any;
}

// =================================================================
// 🎨 UPGRADED CUSTOM NODE RENDERERS (With active tool badges)
// =================================================================

const BuilderAgentNode = React.memo(({ data, selected }: any) => {
    const activeTools = data.tools || [];

    return (
        <div className={`px-4 py-3.5 rounded-xl border text-xs font-mono shadow-md text-left transition-all min-w-[190px] max-w-[240px] bg-white relative ${selected
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg scale-[1.02]'
            : 'border-zinc-200 hover:border-zinc-300'
            }`}>
            <div className="absolute top-1 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-40">
                Agent Node
            </div>
            <div className="border-b border-zinc-100 pb-1 mb-1.5 flex items-center gap-1.5 select-none font-bold text-zinc-800">
                <span>🤖</span> {data.name?.toUpperCase() || "UNNAMED"}
            </div>
            <div className="space-y-1.5 text-[10px] text-zinc-500 leading-normal">
                <div>• Mode: <span className="font-bold text-zinc-700 bg-zinc-100 px-1 py-0.5 rounded">{data.model_mode?.toUpperCase() || "FAST"}</span></div>

                {/* Visual Active Tool Badges */}
                <div className="space-y-1">
                    <div>• Active Skills:</div>
                    {activeTools.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5 max-h-16 overflow-y-auto pr-0.5">
                            {activeTools.map((t: string) => (
                                <span key={t} className="bg-blue-50 text-blue-600 px-1 py-0.2 rounded border border-blue-100 text-[8px] font-mono leading-none">
                                    {t}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <span className="text-zinc-400 italic">No tools assigned</span>
                    )}
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#3b82f6', width: '7px', height: '7px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#3b82f6', width: '7px', height: '7px' }} />
        </div>
    );
});

const BuilderValidatorNode = React.memo(({ data, selected }: any) => {
    return (
        <div className={`px-4 py-3.5 rounded-xl border text-xs font-mono shadow-md text-left transition-all min-w-[190px] max-w-[240px] bg-white relative ${selected
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg scale-[1.02]'
            : 'border-zinc-200 hover:border-zinc-300'
            }`}>
            <div className="absolute top-1 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-40">
                Validator
            </div>
            <div className="border-b border-zinc-100 pb-1 mb-1.5 flex items-center gap-1.5 select-none font-bold text-zinc-855">
                <span>🛡️</span> {data.name?.toUpperCase() || "UNNAMED"}
            </div>
            <div className="space-y-1 text-[10px] text-zinc-500 leading-normal">
                <div className="truncate">• Target: <span className="font-semibold text-zinc-700 bg-zinc-100 px-1 py-0.5 rounded">{data.target_file_key || "target_file"}</span></div>

                <div className="pt-1.5 mt-1 border-t border-zinc-100 flex flex-col gap-0.5 text-[8px] text-zinc-400 select-none">
                    <div className="flex justify-between">
                        <span>Success path:</span>
                        <span className="text-emerald-600 font-bold">{data.next_on_success || "end"}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Failure path:</span>
                        <span className="text-rose-500 font-bold">{data.next_on_failure || "none"}</span>
                    </div>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#10b981', width: '7px', height: '7px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#10b981', width: '7px', height: '7px' }} />
        </div>
    );
});

const nodeTypes = {
    agent: BuilderAgentNode,
    validator: BuilderValidatorNode
};

// =================================================================
// ⚙️ FSM GRAPH TEMPLATES CONFIG
// =================================================================
const FSM_TEMPLATES = {
    bug_fixer: {
        harness_name: "bug_fixer_flow",
        description: "Quy trình lặp tự động tìm lỗi, sửa mã nguồn, xác thực cú pháp và biên dịch vá lỗi [5]",
        initial_node: "planner",
        nodes: [
            { id: "planner", type: "agent", x: 80, y: 150, name: "planner", model_mode: "fast", system_prompt: "Phân tích yêu cầu và định vị file nguồn.", tools: ["find_files", "find_content"] },
            { id: "coder", type: "agent", x: 340, y: 150, name: "coder", model_mode: "fast", system_prompt: "Nhận kế hoạch và viết code thay thế.", tools: ["replace_content_safe", "write_file"] },
            { id: "validator", type: "validator", x: 600, y: 150, name: "validator", target_file_key: "target_file", next_on_success: "end", next_on_failure: "healer" },
            { id: "healer", type: "agent", x: 340, y: 350, name: "healer", model_mode: "thinking", system_prompt: "Sửa lỗi biên dịch do validator trả về.", tools: ["replace_content_safe"] }
        ],
        edges: [
            { id: "edge-planner-coder", source: "planner", target: "coder" },
            { id: "edge-coder-validator", source: "coder", target: "validator" },
            { id: "edge-validator-healer", source: "validator", target: "healer", data: { pathType: "failure" } },
            { id: "edge-healer-coder", source: "healer", target: "coder" }
        ]
    },
    security_scanner: {
        harness_name: "security_scanner_flow",
        description: "Quy trình tự động quét tĩnh mã nguồn bảo mật và vá các lỗ hổng nghiêm trọng [5]",
        initial_node: "auditor",
        nodes: [
            { id: "auditor", type: "agent", x: 100, y: 150, name: "auditor", model_mode: "fast", system_prompt: "Quét file nguồn tìm các lỗ hổng (SQLi, Command Injection).", tools: ["read_file"] },
            { id: "patcher", type: "agent", x: 380, y: 150, name: "patcher", model_mode: "thinking", system_prompt: "Tiến hành vá bảo mật mã nguồn.", tools: ["replace_content_safe"] },
            { id: "validator", type: "validator", x: 650, y: 150, name: "validator", target_file_key: "target_file", next_on_success: "end", next_on_failure: "patcher" }
        ],
        edges: [
            { id: "edge-auditor-patcher", source: "auditor", target: "patcher" },
            { id: "edge-patcher-validator", source: "patcher", target: "validator" },
            { id: "edge-validator-patcher", source: "validator", target: "patcher", data: { pathType: "failure" } }
        ]
    },
    doc_generator: {
        harness_name: "doc_generator_flow",
        description: "Quy trình quét cấu trúc thư mục, sinh tài liệu Markdown API và soát chính tả lỗi văn phong [5]",
        initial_node: "inspector",
        nodes: [
            { id: "inspector", type: "agent", x: 80, y: 150, name: "inspector", model_mode: "fast", system_prompt: "Khảo sát và trích xuất cấu trúc thư mục dự án.", tools: ["list_directory"] },
            { id: "drafter", type: "agent", x: 340, y: 150, name: "drafter", model_mode: "fast", system_prompt: "Biên soạn dự thảo tài liệu Markdown API.", tools: ["read_file"] },
            { id: "proofreader", type: "validator", x: 600, y: 150, name: "proofreader", target_file_key: "target_file", next_on_success: "end", next_on_failure: "drafter" }
        ],
        edges: [
            { id: "edge-inspector-drafter", source: "inspector", target: "drafter" },
            { id: "edge-drafter-proofreader", source: "drafter", target: "proofreader" },
            { id: "edge-proofreader-drafter", source: "proofreader", target: "drafter", data: { pathType: "failure" } }
        ]
    }
};

export function GraphBuilder({ onSaveSuccess, editConfig }: GraphBuilderProps) {
    const [harnessName, setHarnessName] = useState("custom_agent_workflow");
    const [description, setDescription] = useState("Mô tả quy trình tự động hóa...");
    const [entryPoint, setEntryPoint] = useState("planner");

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Tải danh sách Skills từ Server
    useEffect(() => {
        fetch('/api/skills')
            .then(res => res.json())
            .then(data => {
                if (data.skills) {
                    setAvailableSkills(data.skills.map((name: string) => ({ name, desc: "" })));
                }
            })
            .catch(err => console.error("Không thể tải danh sách Skills:", err));
    }, []);

    // Helper: Định dạng kiểu dáng đường nối trực quan (Ép kiểu an toàn)
    const formatEdgeStyle = useCallback((edge: Edge, pathType: "success" | "failure" | "default") => {
        if (pathType === "success") {
            return {
                ...edge,
                label: "✓ Success",
                animated: true,
                style: { stroke: '#10b981', strokeWidth: 2, strokeDasharray: '4,4' },
                labelStyle: { fill: '#10b981', fontWeight: 700, fontSize: 9 },
                labelBgStyle: { fill: '#f0fdf4', fillOpacity: 0.9, stroke: '#10b981', strokeWidth: 1, rx: 4 },
                data: { ...edge.data, pathType: "success" }
            };
        } else if (pathType === "failure") {
            return {
                ...edge,
                label: "✗ Failure",
                animated: true,
                style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4,4' },
                labelStyle: { fill: '#ef4444', fontWeight: 700, fontSize: 9 },
                labelBgStyle: { fill: '#fef2f2', fillOpacity: 0.9, stroke: '#ef4444', strokeWidth: 1, rx: 4 },
                data: { ...edge.data, pathType: "failure" }
            };
        } else {
            return {
                ...edge,
                label: "",
                animated: true,
                style: { stroke: '#3b82f6', strokeWidth: 2 },
                data: { ...edge.data, pathType: "default" }
            };
        }
    }, []);

    // 2. KHAI BÁO HÀM NẠP MẪU ĐỒ THỊ
    const handleLoadTemplate = useCallback((templateKey: keyof typeof FSM_TEMPLATES) => {
        const t = FSM_TEMPLATES[templateKey];
        if (!t) return;

        setHarnessName(t.harness_name);
        setDescription(t.description);
        setEntryPoint(t.initial_node);

        const loadedNodes = t.nodes.map(n => ({
            id: n.id,
            type: n.type,
            position: { x: n.x, y: n.y },
            data: n.type === 'agent' ? {
                name: n.name,
                type: "agent",
                system_prompt: n.system_prompt,
                tools: n.tools || [],
                model_mode: n.model_mode || "fast"
            } : {
                name: n.name,
                type: "validator",
                target_file_key: n.target_file_key || "target_file",
                next_on_success: n.next_on_success || "end",
                next_on_failure: n.next_on_failure || ""
            }
        }));

        const loadedEdges = t.edges.map(e => {
            // SỬA LỖI ts(2345): Ép kiểu an toàn (Type Assertion) ngăn trình biên dịch báo lỗi string không tương thích
            const pathType = (e.data?.pathType as "success" | "failure" | "default") || "default";
            const baseEdge = {
                id: e.id,
                source: e.source,
                target: e.target,
                markerEnd: { type: MarkerType.ArrowClosed }
            } as Edge;
            return formatEdgeStyle(baseEdge, pathType);
        });

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    }, [setNodes, setEdges, formatEdgeStyle]);

    // 3. ĐỒNG BỘ ĐỒ THỊ CHỈNH SỬA EDITCONFIG
    useEffect(() => {
        if (editConfig) {
            setHarnessName(editConfig.harness_name || "custom_agent_workflow");
            setDescription(editConfig.description || "");
            setEntryPoint(editConfig.initial_node || "");

            const importedNodes: Node[] = [];
            const importedEdges: Edge[] = [];

            if (editConfig.nodes) {
                Object.entries(editConfig.nodes).forEach(([nodeId, nodeVal]: [string, any], idx) => {
                    importedNodes.push({
                        id: nodeId,
                        type: nodeVal.type || "agent",
                        position: { x: 100 + (idx * 220) % 660, y: 150 + Math.floor(idx / 3) * 160 },
                        data: nodeVal.type === 'agent' ? {
                            name: nodeId,
                            type: "agent",
                            system_prompt: nodeVal.system_prompt || "",
                            tools: nodeVal.tools || [],
                            model_mode: nodeVal.model_mode || "fast"
                        } : {
                            name: nodeId,
                            type: "validator",
                            target_file_key: nodeVal.target_file_key || "target_file",
                            next_on_success: nodeVal.next_on_success || "end",
                            next_on_failure: nodeVal.next_on_failure || ""
                        }
                    });
                });
            }

            if (Array.isArray(editConfig.edges)) {
                editConfig.edges.forEach((e: any, idx: number) => {
                    const baseEdge = {
                        id: `imported-edge-${idx}`,
                        source: e.from,
                        target: e.to,
                        markerEnd: { type: MarkerType.ArrowClosed }
                    } as Edge;
                    importedEdges.push(formatEdgeStyle(baseEdge, "default"));
                });
            }

            if (Array.isArray(editConfig.conditional_edges)) {
                editConfig.conditional_edges.forEach((ce: any, idx: number) => {
                    if (ce.router) {
                        if (ce.router.is_empty) {
                            const baseEdge = {
                                id: `imported-cond-edge-success-${idx}`,
                                source: ce.from,
                                target: ce.router.is_empty,
                                markerEnd: { type: MarkerType.ArrowClosed }
                            } as Edge;
                            importedEdges.push(formatEdgeStyle(baseEdge, "success"));
                        }
                        if (ce.router.is_not_empty) {
                            const baseEdge = {
                                id: `imported-cond-edge-fail-${idx}`,
                                source: ce.from,
                                target: ce.router.is_not_empty,
                                markerEnd: { type: MarkerType.ArrowClosed }
                            } as Edge;
                            importedEdges.push(formatEdgeStyle(baseEdge, "failure"));
                        }
                    }
                });
            }

            setNodes(importedNodes);
            setEdges(importedEdges);
            setSelectedNodeId(null);
            setSelectedEdgeId(null);
        }
    }, [editConfig, setNodes, setEdges, formatEdgeStyle]);

    // Khởi tạo đồ thị Bug Fixer mặc định khi mở thiết kế
    useEffect(() => {
        handleLoadTemplate("bug_fixer");
    }, [handleLoadTemplate]);

    // Xử lý tạo kết nối (Kéo từ Validator thì tự động rải đường Success/Failure tiện lợi)
    const onConnect = useCallback((params: Connection) => {
        const sourceNode = nodes.find(n => n.id === params.source);
        let defaultPathType: "success" | "failure" | "default" = "default";

        if (sourceNode?.data?.type === 'validator') {
            const existingOutEdges = edges.filter(e => e.source === params.source);
            const hasSuccess = existingOutEdges.some(e => e.data?.pathType === 'success');
            defaultPathType = hasSuccess ? "failure" : "success";
        }

        setEdges((eds) => {
            const baseEdge = {
                ...params,
                id: `edge-${params.source}-${params.target}`,
                markerEnd: { type: MarkerType.ArrowClosed }
            } as Edge;
            return addEdge(formatEdgeStyle(baseEdge, defaultPathType), eds);
        });
    }, [setEdges, nodes, edges, formatEdgeStyle]);

    const handleSwitchEdgeType = (pathType: "success" | "failure" | "default") => {
        if (!selectedEdgeId) return;
        setEdges((eds) => eds.map((e) => {
            if (e.id === selectedEdgeId) {
                return formatEdgeStyle(e, pathType);
            }
            return e;
        }));
    };

    const handleResetCanvas = () => {
        if (!confirm("🧹 Bạn có muốn dọn sạch toàn bộ Nodes & Edges trên bàn thiết kế hiện hành?")) return;
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setHarnessName("empty_workflow");
        setDescription("");
        setEntryPoint("");
    };

    const handleExportJSON = () => {
        const harnessConfig = compileToJSON();
        const blob = new Blob([JSON.stringify(harnessConfig, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${harnessName || 'fsm_workflow'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImportJSONClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string);

                setHarnessName(config.harness_name || "imported_workflow");
                setDescription(config.description || "");
                setEntryPoint(config.initial_node || "");

                const importedNodes: Node[] = [];
                const importedEdges: Edge[] = [];

                if (config.nodes) {
                    Object.entries(config.nodes).forEach(([nodeId, nodeVal]: [string, any], idx) => {
                        importedNodes.push({
                            id: nodeId,
                            type: nodeVal.type || "agent",
                            position: { x: 100 + (idx * 220) % 660, y: 150 + Math.floor(idx / 3) * 160 },
                            data: nodeVal.type === 'agent' ? {
                                name: nodeId,
                                type: "agent",
                                system_prompt: nodeVal.system_prompt || "",
                                tools: nodeVal.tools || [],
                                model_mode: nodeVal.model_mode || "fast"
                            } : {
                                name: nodeId,
                                type: "validator",
                                target_file_key: nodeVal.target_file_key || "target_file",
                                next_on_success: nodeVal.next_on_success || "end",
                                next_on_failure: nodeVal.next_on_failure || ""
                            }
                        });
                    });
                }

                if (Array.isArray(config.edges)) {
                    config.edges.forEach((e: any, idx: number) => {
                        const baseEdge = {
                            id: `imported-edge-${idx}`,
                            source: e.from,
                            target: e.to,
                            markerEnd: { type: MarkerType.ArrowClosed }
                        } as Edge;
                        importedEdges.push(formatEdgeStyle(baseEdge, "default"));
                    });
                }

                if (Array.isArray(config.conditional_edges)) {
                    config.conditional_edges.forEach((ce: any, idx: number) => {
                        if (ce.router) {
                            if (ce.router.is_empty) {
                                const baseEdge = {
                                    id: `imported-cond-edge-success-${idx}`,
                                    source: ce.from,
                                    target: ce.router.is_empty,
                                    markerEnd: { type: MarkerType.ArrowClosed }
                                } as Edge;
                                importedEdges.push(formatEdgeStyle(baseEdge, "success"));
                            }
                            if (ce.router.is_not_empty) {
                                const baseEdge = {
                                    id: `imported-cond-edge-fail-${idx}`,
                                    source: ce.from,
                                    target: ce.router.is_not_empty,
                                    markerEnd: { type: MarkerType.ArrowClosed }
                                } as Edge;
                                importedEdges.push(formatEdgeStyle(baseEdge, "failure"));
                            }
                        }
                    });
                }

                setNodes(importedNodes);
                setEdges(importedEdges);
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setMessage({ text: `✓ Đã nhập tệp tin sơ đồ thành công!`, type: "success" });
            } catch (err: any) {
                alert("Lỗi phân tích cú pháp tệp JSON tải lên: " + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const handleAddNode = (type: "agent" | "validator", customX?: number, customY?: number) => {
        const id = `${type}_${Date.now().toString().substring(8)}`;
        const newNode: Node = {
            id,
            position: { x: customX || 250, y: customY || 200 },
            type: type,
            data: type === 'agent' ? {
                name: id,
                type: "agent",
                system_prompt: "Chỉ thị hệ thống cho Agent mới...",
                tools: [],
                model_mode: "fast"
            } : {
                name: id,
                type: "validator",
                target_file_key: "target_file",
                next_on_success: "end",
                next_on_failure: ""
            }
        };

        setNodes((nds) => [...nds, newNode]);
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    };

    const handleDragStart = (e: React.DragEvent, nodeType: "agent" | "validator") => {
        e.dataTransfer.setData("application/reactflow", nodeType);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const nodeType = e.dataTransfer.getData("application/reactflow") as "agent" | "validator";
        if (!nodeType) return;

        const reactFlowBounds = document.querySelector(".react-flow")?.getBoundingClientRect();
        if (!reactFlowBounds) return;

        const x = e.clientX - reactFlowBounds.left - 90;
        const y = e.clientY - reactFlowBounds.top - 40;

        handleAddNode(nodeType, x, y);
    };

    const selectedNode = useMemo(() => {
        return nodes.find(n => n.id === selectedNodeId) || null;
    }, [nodes, selectedNodeId]);

    const selectedEdge = useMemo(() => {
        return edges.find(e => e.id === selectedEdgeId) || null;
    }, [edges, selectedEdgeId]);

    const handleUpdateSelectedNodeData = (updatedData: Partial<EditableNodeData>) => {
        if (!selectedNodeId) return;
        setNodes((nds) => nds.map((n) => {
            if (n.id === selectedNodeId) {
                return {
                    ...n,
                    data: { ...n.data, ...updatedData }
                };
            }
            return n;
        }));
    };

    const handleDeleteNode = () => {
        if (!selectedNodeId) return;
        setNodes((nds) => nds.filter(n => n.id !== selectedNodeId));
        setEdges((eds) => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
        setSelectedNodeId(null);
    };

    const handleDeleteEdge = () => {
        if (!selectedEdgeId) return;
        setEdges((eds) => eds.filter(e => e.id !== selectedEdgeId));
        setSelectedEdgeId(null);
    };

    // REAL-TIME CONFIGURATION LINTER
    const linterWarnings = useMemo(() => {
        const warnings: string[] = [];

        // 1. Kiểm tra điểm khởi chạy (Initial Node)
        if (entryPoint && !nodes.some(n => n.id === entryPoint)) {
            warnings.push(`⚠️ Điểm khởi chạy "${entryPoint}" không khớp với bất kỳ Node ID nào.`);
        }

        // 2. Kiểm tra các Node mồ côi (Cô lập)
        nodes.forEach(n => {
            const hasIncoming = edges.some(e => e.target === n.id);
            const hasOutgoing = edges.some(e => e.source === n.id);
            if (n.id !== entryPoint && !hasIncoming && !hasOutgoing) {
                warnings.push(`⚠️ Node "${n.id.toUpperCase()}" đang bị cô lập khỏi luồng điều phối.`);
            }
        });

        // 3. Kiểm tra Validator thiếu phân nhánh rẽ hướng Success/Failure
        nodes.forEach(n => {
            if (n.data?.type === 'validator') {
                const outEdges = edges.filter(e => e.source === n.id);
                const hasSuccess = outEdges.some(e => e.data?.pathType === 'success');
                const hasFailure = outEdges.some(e => e.data?.pathType === 'failure');

                if (!hasSuccess) {
                    warnings.push(`⚠️ Validator "${n.id.toUpperCase()}" thiếu dây rẽ nhánh "✓ Success".`);
                }
                if (!hasFailure) {
                    warnings.push(`⚠️ Validator "${n.id.toUpperCase()}" thiếu dây rẽ nhánh "✗ Failure".`);
                }
            }
        });

        return warnings;
    }, [nodes, edges, entryPoint]);

    // Biên dịch thông minh: Ánh xạ rẽ nhánh Validator trực tiếp từ Edges
    const compileToJSON = () => {
        const compiledNodes: Record<string, any> = {};

        nodes.forEach(n => {
            const d = n.data as EditableNodeData;

            if (d.type === 'agent') {
                compiledNodes[n.id] = {
                    type: "agent",
                    system_prompt: d.system_prompt,
                    tools: d.tools,
                    model_mode: d.model_mode
                };
            } else {
                const outEdges = edges.filter(e => e.source === n.id);
                const successEdge = outEdges.find(e => e.data?.pathType === 'success');
                const failureEdge = outEdges.find(e => e.data?.pathType === 'failure');

                const nextOnSuccess = successEdge ? successEdge.target : (d.next_on_success || "end");
                const nextOnFailure = failureEdge ? failureEdge.target : (d.next_on_failure || "");

                compiledNodes[n.id] = {
                    type: "validator",
                    validation_rule: "syntax_only",
                    target_file_key: d.target_file_key || "target_file",
                    next_on_success: nextOnSuccess,
                    next_on_failure: nextOnFailure
                };
            }
        });

        const compiledEdges: any[] = [];
        const conditionalEdges: any[] = [];

        edges.forEach(e => {
            const sourceNode = nodes.find(n => n.id === e.source);
            const sourceData = sourceNode?.data as EditableNodeData;

            if (sourceData && sourceData.type === 'validator') {
                const alreadyExists = conditionalEdges.some(ce => ce.from === e.source);
                if (!alreadyExists) {
                    const outEdges = edges.filter(ed => ed.source === e.source);
                    const successEdge = outEdges.find(ed => ed.data?.pathType === 'success');
                    const failureEdge = outEdges.find(ed => ed.data?.pathType === 'failure');

                    const is_empty = successEdge ? successEdge.target : (sourceData.next_on_success || "end");
                    const is_not_empty = failureEdge ? failureEdge.target : (sourceData.next_on_failure || "");

                    conditionalEdges.push({
                        from: e.source,
                        condition_type: "state_check",
                        state_key: "errors",
                        router: {
                            is_empty,
                            is_not_empty
                        }
                    });
                }
            } else {
                compiledEdges.push({
                    from: e.source,
                    to: e.target
                });
            }
        });

        return {
            harness_name: harnessName,
            description,
            initial_node: entryPoint,
            state_schema: {
                task: "",
                target_file: "",
                pending_code: "",
                errors: [],
                retry_count: 0,
                next_node: ""
            },
            nodes: compiledNodes,
            edges: compiledEdges,
            conditional_edges: conditionalEdges
        };
    };

    const handleSaveHarness = () => {
        setSaving(true);
        setMessage(null);

        const harnessConfig = compileToJSON();

        fetch('/api/dashboard/harnesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(harnessConfig)
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setMessage({ text: data.message, type: "success" });
                    if (onSaveSuccess) {
                        onSaveSuccess();
                    }
                } else {
                    throw new Error(data.error || "Gặp lỗi không rõ");
                }
            })
            .catch(err => {
                setMessage({ text: err.message, type: "error" });
            })
            .finally(() => setSaving(false));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-140px)] gap-4 select-none text-left">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImportChange}
                className="hidden"
                accept=".json"
            />

            {/* CỘT TRÁI: ReactFlow CANVAS */}
            <div className="lg:col-span-8 border border-zinc-200 rounded-2xl relative bg-zinc-50 overflow-hidden shadow-xs flex flex-col h-full">

                {/* 🛠️ Top Bar Controls */}
                <div className="p-3 bg-white border-b border-zinc-200 flex flex-wrap justify-between items-center gap-2 select-none z-10 shrink-0">
                    <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => handleAddNode("agent")}>
                            ➕ Click thêm Agent
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => handleAddNode("validator")}>
                            ➕ Click thêm Validator
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer text-red-655 border-red-200 hover:bg-red-50" onClick={handleResetCanvas}>
                            🧹 Dọn Canvas
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            onChange={(e) => handleLoadTemplate(e.target.value as any)}
                            defaultValue="bug_fixer"
                            className="h-7 px-2.5 bg-white border border-zinc-200 hover:border-zinc-350 rounded text-[10px] font-bold outline-none cursor-pointer text-zinc-700"
                        >
                            <option value="bug_fixer">🐞 Mẫu: Bug-Fixer Loop</option>
                            <option value="security_scanner">🛡️ Mẫu: Secure-Scanner</option>
                            <option value="doc_generator">📖 Mẫu: Doc-Generator</option>
                        </select>

                        <button
                            type="button"
                            onClick={handleImportJSONClick}
                            className="px-2.5 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-800 rounded text-[10px] font-bold cursor-pointer transition-colors shadow-3xs"
                        >
                            📤 Upload JSON
                        </button>
                        <button
                            type="button"
                            onClick={handleExportJSON}
                            className="px-2.5 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-800 rounded text-[10px] font-bold cursor-pointer transition-colors shadow-3xs"
                        >
                            📥 Download JSON
                        </button>
                    </div>
                </div>

                {/* ReactFlow Editor Container */}
                <div
                    className="flex-1 w-full h-full relative"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={(_, node) => {
                            setSelectedNodeId(node.id);
                            setSelectedEdgeId(null);
                        }}
                        onEdgeClick={(_, edge) => {
                            setSelectedEdgeId(edge.id);
                            setSelectedNodeId(null);
                        }}
                        nodeTypes={nodeTypes}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background color="#cbd5e1" gap={16} size={1} />
                        <Controls />
                        <MiniMap />
                    </ReactFlow>

                    {/* FLOATING DRAG PALETTE ON CANVAS */}
                    <div className="absolute bottom-4 left-4 z-20 bg-white/95 border border-zinc-200 shadow-xl rounded-xl p-3.5 flex flex-col gap-2 select-none pointer-events-auto">
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block text-left mb-1">
                            Kéo vật liệu vào Sơ đồ
                        </span>
                        <div className="flex gap-2">
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, "agent")}
                                className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs font-mono font-bold cursor-grab active:cursor-grabbing hover:bg-blue-100 flex items-center gap-1.5 shadow-3xs"
                                title="Kéo thả Agent Node vào Canvas"
                            >
                                <span>🤖</span> Agent
                            </div>
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, "validator")}
                                className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-xs font-mono font-bold cursor-grab active:cursor-grabbing hover:bg-emerald-100 flex items-center gap-1.5 shadow-3xs"
                                title="Kéo thả Validator Node vào Canvas"
                            >
                                <span>🛡️</span> Validator
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CỘT PHẢI: CONFIG PANEL SIDEBAR */}
            <div className="lg:col-span-4 border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 flex flex-col h-full overflow-y-auto space-y-4 font-sans select-none">

                {/* 1. Thiết lập chung */}
                <div className="space-y-3 bg-white p-4 rounded-xl border border-zinc-200 shadow-3xs text-left select-text">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider select-none border-b pb-1">⚙️ Cài đặt chung (Harness)</h3>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Tên Quy Trình (Harness Key)</label>
                        <input
                            type="text"
                            value={harnessName}
                            onChange={(e) => setHarnessName(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold outline-none focus:border-zinc-300"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Mô tả quy trình</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-zinc-300 resize-none leading-relaxed"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Điểm khởi chạy (Entry Point Node ID)</label>
                        <input
                            type="text"
                            value={entryPoint}
                            onChange={(e) => setEntryPoint(e.target.value)}
                            placeholder="planner"
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold outline-none focus:border-zinc-300"
                        />
                    </div>
                </div>

                {/* REAL-TIME CANVAS LINTER ACCORDION */}
                {linterWarnings.length > 0 && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-left shrink-0">
                        <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest block select-none">
                            🚨 Trình kiểm duyệt lỗi sơ đồ (Live Linter)
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
                            {linterWarnings.map((w, wIdx) => (
                                <p key={wIdx} className="text-[10px] text-rose-700 leading-normal font-medium select-text">
                                    {w}
                                </p>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Cấu hình phần tử đang chọn (Node / Edge) */}
                <div className="flex-1 bg-white p-4 rounded-xl border border-zinc-200 shadow-3xs flex flex-col text-left select-text min-h-[300px]">

                    {/* NODE CONFIGURATION PANEL */}
                    {selectedNode && (
                        <div className="space-y-4 flex-1 flex flex-col overflow-y-auto">
                            <div className="flex justify-between items-center select-none border-b pb-1.5 shrink-0">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${selectedNode.data.type === 'agent' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                    }`}>
                                    {selectedNode.data.type} Node
                                </span>
                                <Button size="sm" variant="ghost" onClick={handleDeleteNode} className="h-6 text-[9px] text-red-655 hover:bg-red-50 cursor-pointer">
                                    🗑️ Xóa Node
                                </Button>
                            </div>

                            <div className="space-y-1 shrink-0">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Node ID (Khóa định danh)</label>
                                <input
                                    type="text"
                                    value={selectedNode.data.name}
                                    onChange={(e) => handleUpdateSelectedNodeData({ name: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold outline-none"
                                />
                            </div>

                            {/* CẤU HÌNH CHO AGENT */}
                            {selectedNode.data.type === 'agent' && (
                                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                    <div className="space-y-1 shrink-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Mức tư duy (Model Mode)</label>
                                        <select
                                            value={selectedNode.data.model_mode || "fast"}
                                            onChange={(e) => handleUpdateSelectedNodeData({ model_mode: e.target.value as any })}
                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-semibold outline-none text-zinc-700 cursor-pointer"
                                        >
                                            <option value="fast">⚡ Fast (Mô hình xử lý nhanh)</option>
                                            <option value="thinking">🧠 DeepThink (Suy nghĩ sâu)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1 flex-1 flex flex-col min-h-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">System Prompt (Chỉ thị hệ thống)</label>
                                        <textarea
                                            value={selectedNode.data.system_prompt || ""}
                                            onChange={(e) => handleUpdateSelectedNodeData({ system_prompt: e.target.value })}
                                            placeholder="Bạn là chuyên gia... Đọc bối cảnh sau: ${state.last_output}"
                                            className="w-full flex-1 p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none font-mono leading-relaxed"
                                        />
                                    </div>

                                    <div className="space-y-1.5 shrink-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Năng lực gán (Tools)</label>
                                        <div className="border border-zinc-200 rounded-lg p-2.5 max-h-24 overflow-y-auto space-y-1 select-none">
                                            {availableSkills.map(skill => {
                                                const isChecked = selectedNode.data.tools?.includes(skill.name);
                                                return (
                                                    <div key={skill.name} className="flex items-center gap-2">
                                                        <input
                                                            id={`skill_chk_${skill.name}`}
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                const currentTools = selectedNode.data.tools || [];
                                                                const nextTools = e.target.checked
                                                                    ? [...currentTools, skill.name]
                                                                    : currentTools.filter((t: string) => t !== skill.name);
                                                                handleUpdateSelectedNodeData({ tools: nextTools });
                                                            }}
                                                            className="w-3.5 h-3.5 text-blue-600 border-zinc-300 rounded cursor-pointer"
                                                        />
                                                        <label htmlFor={`skill_chk_${skill.name}`} className="text-[10px] font-mono text-zinc-655 cursor-pointer">{skill.name}</label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CẤU HÌNH CHO VALIDATOR */}
                            {selectedNode.data.type === 'validator' && (
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Khóa tệp tin cần kiểm duyệt</label>
                                        <input
                                            type="text"
                                            value={selectedNode.data.target_file_key || "target_file"}
                                            onChange={(e) => handleUpdateSelectedNodeData({ target_file_key: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold"
                                        />
                                    </div>

                                    <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5">
                                        <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider block">
                                            💡 HƯỚNG DẪN KẾT NỐI RẼ NHÁNH
                                        </span>
                                        <p className="text-[10px] text-zinc-500 leading-normal leading-relaxed">
                                            Để cấu hình đường dẫn rẽ hướng cho Validator này, hãy kết nối dây từ node này sang node khác trên Canvas, sau đó **Click chọn dây nối (Edge)** để gán thuộc tính rẽ nhánh **Success** hoặc **Failure**.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* EDGE CONFIGURATION PANEL */}
                    {selectedEdge && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center select-none border-b pb-1.5 shrink-0">
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-purple-50 border-purple-200 text-purple-600">
                                    Edge Connection
                                </span>
                                <Button size="sm" variant="ghost" onClick={handleDeleteEdge} className="h-6 text-[9px] text-red-655 hover:bg-red-50 cursor-pointer">
                                    🗑️ Xóa dây nối
                                </Button>
                            </div>

                            <div className="space-y-1 text-xs text-zinc-500 font-mono">
                                <div>• Source Node: <span className="font-bold text-zinc-700">{selectedEdge.source}</span></div>
                                <div>• Target Node: <span className="font-bold text-zinc-700">{selectedEdge.target}</span></div>
                            </div>

                            {/* CHỌN ĐƯỜNG DẪN HOẠT ĐỘNG CHO DÂY */}
                            <div className="space-y-2 pt-2 border-t">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Cấu hình rẽ nhánh điều kiện</label>
                                <div className="flex flex-col gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchEdgeType("default")}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${!selectedEdge.data?.pathType || selectedEdge.data?.pathType === 'default'
                                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                                            : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                            }`}
                                    >
                                        🔵 Connection thông thường
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchEdgeType("success")}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${selectedEdge.data?.pathType === 'success'
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                                            : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                            }`}
                                    >
                                        🟢 Success Path (Khi xác thực thành công)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchEdgeType("failure")}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${selectedEdge.data?.pathType === 'failure'
                                            ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                                            : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                            }`}
                                    >
                                        🔴 Failure Path (Khi kiểm duyệt phát hiện lỗi)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!selectedNode && !selectedEdge && (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 py-20 text-center select-none italic text-xs">
                            💡 Nhấp chọn một Node hoặc dây nối (Edge) trên Canvas để bắt đầu cấu hình rẽ nhánh.
                        </div>
                    )}
                </div>

                {/* Thanh hiển thị thông báo phản hồi */}
                {message && (
                    <div className={`p-3 rounded-lg text-xs font-mono font-medium shrink-0 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-55 border border-red-200 text-red-700'
                        }`}>
                        {message.type === 'success' ? '✓' : '✗'} {message.text}
                    </div>
                )}

                {/* Submit button */}
                <Button
                    onClick={handleSaveHarness}
                    disabled={saving || nodes.length === 0}
                    className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white shrink-0 font-bold border-none"
                >
                    {saving ? "⏳ Đang đồng bộ nóng..." : "🚀 Biên dịch & Deploy Đồ thị"}
                </Button>
            </div>
        </div>
    );
}