// filepath: bridge_client/src/components/GraphBuilder.tsx
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

interface GraphBuilderProps {
    onSaveSuccess?: () => void;
    editConfig?: any;
}

// =================================================================
// 🎨 CUSTOM NODE RENDERERS (Sơ đồ màu sắc bắt mắt, sửa lỗi Blank Nodes)
// =================================================================

const BuilderAgentNode = React.memo(({ data, selected }: any) => {
    const activeToolsCount = data.tools ? data.tools.length : 0;

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono shadow-md text-left transition-all min-w-[170px] max-w-[220px] bg-white relative ${selected
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg scale-[1.02]'
            : 'border-zinc-200 hover:border-zinc-300'
            }`}>
            <div className="absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-40">
                Agent Node
            </div>
            <div className="border-b border-zinc-100 pb-1 mb-1.5 flex items-center gap-1.5 select-none font-bold text-zinc-800">
                <span>🤖</span> {data.name?.toUpperCase() || "UNNAMED"}
            </div>
            <div className="space-y-1 text-[10px] text-zinc-500 leading-normal">
                <div>• Mode: <span className="font-bold text-zinc-700">{data.model_mode?.toUpperCase() || "FAST"}</span></div>
                <div>• Tools: <span className="font-bold text-blue-600">{activeToolsCount} active</span></div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#3b82f6', width: '7px', height: '7px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#3b82f6', width: '7px', height: '7px' }} />
        </div>
    );
});

const BuilderValidatorNode = React.memo(({ data, selected }: any) => {
    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono shadow-md text-left transition-all min-w-[170px] max-w-[220px] bg-white relative ${selected
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg scale-[1.02]'
            : 'border-zinc-200 hover:border-zinc-300'
            }`}>
            <div className="absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-40">
                Validator
            </div>
            <div className="border-b border-zinc-100 pb-1 mb-1.5 flex items-center gap-1.5 select-none font-bold text-zinc-855">
                <span>🛡️</span> {data.name?.toUpperCase() || "UNNAMED"}
            </div>
            <div className="space-y-1 text-[10px] text-zinc-500 leading-normal">
                <div className="truncate">• File: <span className="font-semibold text-zinc-700">{data.target_file_key || "target_file"}</span></div>
                <div className="text-[8px] text-zinc-400 mt-1 select-none">
                    Success: <span className="text-emerald-600 font-bold">{data.next_on_success || "end"}</span> |
                    Fail: <span className="text-rose-500 font-bold">{data.next_on_failure || "none"}</span>
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
// CẤU HÌNH CÁC MẪU ĐỒ THỊ CHUYÊN SÂU (Advanced Templates) [5]
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
            { id: "e1", source: "planner", target: "coder" },
            { id: "e2", source: "coder", target: "validator" },
            { id: "e3", source: "healer", target: "coder" }
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
            { id: "e1", source: "auditor", target: "patcher" },
            { id: "e2", source: "patcher", target: "validator" }
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
            { id: "e1", source: "inspector", target: "drafter" },
            { id: "e2", source: "drafter", target: "proofreader" }
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
    const [availableSkills, setAvailableSkills] = useState<SkillItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // 1. Tải danh sách Skills từ Server (Đưa các Hook lên trước)
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

    // 2. KHAI BÁO HÀM NẠP MẪU TRƯỚC (Để tránh lỗi chưa khởi tạo) [1]
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

        const loadedEdges = t.edges.map(e => ({
            id: `edge-${e.source}-${e.target}`,
            source: e.source,
            target: e.target,
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed }
        }));

        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setSelectedNodeId(null);
    }, [setNodes, setEdges]);

    // 3. ĐỒNG BỘ ĐỒ THỊ CHỈNH SỬA EDITCONFIG [5]
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
                        position: { x: 100 + (idx * 200) % 600, y: 150 + Math.floor(idx / 3) * 150 },
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
                    importedEdges.push({
                        id: `imported-edge-${idx}`,
                        source: e.from,
                        target: e.to,
                        animated: true,
                        style: { stroke: '#3b82f6', strokeWidth: 2 },
                        markerEnd: { type: MarkerType.ArrowClosed }
                    });
                });
            }

            if (Array.isArray(editConfig.conditional_edges)) {
                editConfig.conditional_edges.forEach((ce: any, idx: number) => {
                    if (ce.router) {
                        if (ce.router.is_empty) {
                            importedEdges.push({
                                id: `imported-cond-edge-success-${idx}`,
                                source: ce.from,
                                target: ce.router.is_empty,
                                animated: true,
                                style: { stroke: '#10b981', strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed }
                            });
                        }
                        if (ce.router.is_not_empty) {
                            importedEdges.push({
                                id: `imported-cond-edge-fail-${idx}`,
                                source: ce.from,
                                target: ce.router.is_not_empty,
                                animated: true,
                                style: { stroke: '#ef4444', strokeWidth: 2 },
                                markerEnd: { type: MarkerType.ArrowClosed }
                            });
                        }
                    }
                });
            }

            setNodes(importedNodes);
            setEdges(importedEdges);
            setSelectedNodeId(null);
        }
    }, [editConfig, setNodes, setEdges]);

    // 4. Gọi nạp mặc định tệp Bug Fixer khi mở Canvas lần đầu (Đặt dưới định nghĩa hàm) [1]
    useEffect(() => {
        handleLoadTemplate("bug_fixer");
    }, [handleLoadTemplate]);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge({
            ...params,
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed }
        }, eds));
    }, [setEdges]);

    const handleResetCanvas = () => {
        if (!confirm("🧹 Bạn có muốn dọn sạch toàn bộ Nodes & Edges trên bàn thiết kế hiện hành?")) return;
        setNodes([]);
        setEdges([]);
        setSelectedNodeId(null);
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
                            position: { x: 100 + (idx * 200) % 600, y: 150 + Math.floor(idx / 3) * 150 },
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
                        importedEdges.push({
                            id: `imported-edge-${idx}`,
                            source: e.from,
                            target: e.to,
                            animated: true,
                            style: { stroke: '#3b82f6', strokeWidth: 2 },
                            markerEnd: { type: MarkerType.ArrowClosed }
                        });
                    });
                }

                if (Array.isArray(config.conditional_edges)) {
                    config.conditional_edges.forEach((ce: any, idx: number) => {
                        if (ce.router) {
                            if (ce.router.is_empty) {
                                importedEdges.push({
                                    id: `imported-cond-edge-success-${idx}`,
                                    source: ce.from,
                                    target: ce.router.is_empty,
                                    animated: true,
                                    style: { stroke: '#10b981', strokeWidth: 2 },
                                    markerEnd: { type: MarkerType.ArrowClosed }
                                });
                            }
                            if (ce.router.is_not_empty) {
                                importedEdges.push({
                                    id: `imported-cond-edge-fail-${idx}`,
                                    source: ce.from,
                                    target: ce.router.is_not_empty,
                                    animated: true,
                                    style: { stroke: '#ef4444', strokeWidth: 2 },
                                    markerEnd: { type: MarkerType.ArrowClosed }
                                });
                            }
                        }
                    });
                }

                setNodes(importedNodes);
                setEdges(importedEdges);
                setSelectedNodeId(null);
                setMessage({ text: `✓ Đã nhập tệp tin sơ đồ thành công!`, type: "success" });
            } catch (err: any) {
                alert("Lỗi phân tích cú pháp tệp JSON tải lên: " + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const handleAddNode = (type: "agent" | "validator") => {
        const id = `${type}_${Date.now().toString().substring(8)}`;
        const newNode: Node = {
            id,
            position: { x: 250, y: 200 },
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
    };

    const selectedNode = useMemo(() => {
        return nodes.find(n => n.id === selectedNodeId) || null;
    }, [nodes, selectedNodeId]);

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
                compiledNodes[n.id] = {
                    type: "validator",
                    validation_rule: "syntax_only",
                    target_file_key: d.target_file_key || "target_file",
                    next_on_success: d.next_on_success || "end",
                    next_on_failure: d.next_on_failure || ""
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
                    conditionalEdges.push({
                        from: e.source,
                        condition_type: "state_check",
                        state_key: "errors",
                        router: {
                            is_empty: sourceData.next_on_success || "end",
                            is_not_empty: sourceData.next_on_failure || ""
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

                {/* 🛠️ Thanh điều khiển nâng cao */}
                <div className="p-3 bg-white border-b border-zinc-200 flex flex-wrap justify-between items-center gap-2 select-none z-10 shrink-0">
                    <div className="flex gap-1.5 flex-wrap">
                        <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => handleAddNode("agent")}>
                            ➕ Thêm Agent
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer" onClick={() => handleAddNode("validator")}>
                            ➕ Thêm Validator
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] cursor-pointer text-red-650 border-red-200" onClick={handleResetCanvas}>
                            🧹 Reset Canvas
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Dropdown Mẫu Đồ thị chuyên sâu [5] */}
                        <select
                            onChange={(e) => handleLoadTemplate(e.target.value as any)}
                            defaultValue="bug_fixer"
                            className="h-7 px-2 bg-white border border-zinc-200 hover:border-zinc-300 rounded text-[10px] font-bold outline-none cursor-pointer"
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

                {/* ReactFlow Editor */}
                <div className="flex-1 w-full h-full relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                        nodeTypes={nodeTypes} // ĐĂNG KÝ HÀM KẾT XUẤT ĐẸP ĐÃ SỬA LỖI TRỐNG BOXES!
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background color="#cbd5e1" gap={16} size={1} />
                        <Controls />
                        <MiniMap />
                    </ReactFlow>
                </div>
            </div>

            {/* CỘT PHẢI: FORM CẤU HÌNH SIDEBAR */}
            <div className="lg:col-span-4 border border-zinc-200 rounded-2xl p-4 bg-zinc-50/50 flex flex-col h-full overflow-y-auto space-y-4 font-sans">

                {/* 1. Form cài đặt chung */}
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
                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs outline-none focus:border-zinc-300 resize-none"
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

                {/* 2. Form chỉnh sửa Node đang được chọn */}
                <div className="flex-1 bg-white p-4 rounded-xl border border-zinc-200 shadow-3xs flex flex-col text-left select-text min-h-[300px]">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider select-none border-b pb-1.5 mb-3">📝 Cấu hình Node đang chọn</h3>

                    {selectedNode ? (
                        <div className="space-y-4 flex-1 flex flex-col overflow-y-auto">
                            <div className="flex justify-between items-center select-none shrink-0">
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${selectedNode.data.type === 'agent' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                    }`}>
                                    {selectedNode.data.type}
                                </span>
                                <Button size="sm" variant="ghost" onClick={handleDeleteNode} className="h-6 text-[9px] text-red-600 hover:bg-red-50 cursor-pointer">
                                    🗑️ Xóa Node
                                </Button>
                            </div>

                            <div className="space-y-1 shrink-0">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Node ID (Khóa liên kết)</label>
                                <input
                                    type="text"
                                    value={selectedNode.data.name}
                                    onChange={(e) => handleUpdateSelectedNodeData({ name: e.target.value })}
                                    className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold outline-none"
                                />
                            </div>

                            {/* CẤU HÌNH DÀNH RIÊNG CHO AGENT NODE */}
                            {selectedNode.data.type === 'agent' && (
                                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Mức tư duy (Model Mode)</label>
                                        <select
                                            value={selectedNode.data.model_mode || "fast"}
                                            onChange={(e) => handleUpdateSelectedNodeData({ model_mode: e.target.value as any })}
                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-semibold outline-none"
                                        >
                                            <option value="fast">⚡ Fast (Mô hình tiêu chuẩn)</option>
                                            <option value="thinking">🧠 DeepThink (Tư duy suy luận sâu)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1 flex-1 flex flex-col min-h-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">System Prompt (Chỉ thị hệ thống)</label>
                                        <textarea
                                            value={selectedNode.data.system_prompt || ""}
                                            onChange={(e) => handleUpdateSelectedNodeData({ system_prompt: e.target.value })}
                                            placeholder="Bạn là chuyên gia... Nhận kế hoạch sau: ${state.last_output}"
                                            className="w-full flex-1 p-2 bg-white border border-zinc-200 rounded-lg text-xs outline-none font-mono leading-relaxed"
                                        />
                                    </div>

                                    <div className="space-y-1.5 shrink-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Danh sách Skills được gán (Tools)</label>
                                        <div className="border border-zinc-200 rounded-lg p-2 max-h-24 overflow-y-auto space-y-1">
                                            {availableSkills.map(skill => {
                                                const isChecked = selectedNode.data.tools?.includes(skill.name);
                                                return (
                                                    <div key={skill.name} className="flex items-center gap-1.5">
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
                                                            className="w-3 h-3 text-blue-600 border-zinc-300 rounded cursor-pointer"
                                                        />
                                                        <label htmlFor={`skill_chk_${skill.name}`} className="text-[10px] font-mono text-zinc-650 cursor-pointer">{skill.name}</label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CẤU HÌNH DÀNH RIÊNG CHO VALIDATOR NODE */}
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

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Node kế tiếp khi xác thực thành công</label>
                                        <input
                                            type="text"
                                            value={selectedNode.data.next_on_success || "end"}
                                            onChange={(e) => handleUpdateSelectedNodeData({ next_on_success: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Node rẽ nhánh sửa lỗi khi thất bại</label>
                                        <input
                                            type="text"
                                            value={selectedNode.data.next_on_failure || "healer"}
                                            onChange={(e) => handleUpdateSelectedNodeData({ next_on_failure: e.target.value })}
                                            className="w-full px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-semibold"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 py-20 text-center select-none italic text-xs">
                            💡 Nhấn chọn một Node trên sơ đồ để bắt đầu soạn thảo.
                        </div>
                    )}
                </div>

                {/* Thanh trạng thái lưu trữ */}
                {message && (
                    <div className={`p-3 rounded-lg text-xs font-mono font-medium shrink-0 ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        {message.type === 'success' ? '✓' : '✗'} {message.text}
                    </div>
                )}

                {/* 3. Nút kích hoạt biên dịch & lưu tệp (Hot Deploy) */}
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