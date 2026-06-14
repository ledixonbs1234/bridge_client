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

// Định nghĩa hàm toSafeId xử lý chuẩn hóa tên tiếng Việt phía client
function toSafeId(text: string): string {
    if (!text) return "";
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Loại bỏ các dấu thanh tiếng Việt
        .replace(/[đĐ]/g, m => m === 'đ' ? 'd' : 'D') // Chuyển đ, Đ -> d, D
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_') // Thay thế ký tự đặc biệt còn lại thành _
        .replace(/_+/g, '_') // Gom các dấu gạch dưới lặp lại
        .trim();
}
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
    theme?: "light" | "dark";
    include_global_prompt?: boolean; // <-- Thêm dòng này
}

interface GraphBuilderProps {
    onSaveSuccess?: () => void;
    editConfig?: any;
    theme?: "light" | "dark";
}

// =================================================================
// 🎨 UPGRADED CUSTOM NODE RENDERERS (With active tool badges and dark theme)
// =================================================================

const BuilderAgentNode = React.memo(({ data, selected }: any) => {
    const activeTools = data.tools || [];
    const isDark = data.theme === 'dark';

    const nodeStyle = isDark
        ? `bg-zinc-950/90 text-blue-400 border-blue-500/50 glow-neon-cyan`
        : `bg-white border-zinc-200 hover:border-zinc-300 text-zinc-800`;

    return (
        <div className={`px-4 py-3.5 rounded-xl border text-xs font-mono shadow-md text-left transition-all min-w-[190px] max-w-[240px] relative ${nodeStyle} ${selected
            ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-lg scale-[1.02]'
            : ''
            }`}>
            <div className="absolute top-1 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-40">
                Agent Node
            </div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none font-bold ${isDark ? "border-zinc-800 text-zinc-200" : "border-zinc-100 text-zinc-800"}`}>
                <span>🤖</span> {data.name?.toUpperCase() || "UNNAMED"}
            </div>
            <div className="space-y-1.5 text-[10px] text-zinc-500 leading-normal">
                <div>• Mode: <span className={`font-bold px-1 py-0.5 rounded ${isDark ? "bg-zinc-900 text-zinc-350" : "bg-zinc-100 text-zinc-700"}`}>{data.model_mode?.toUpperCase() || "FAST"}</span></div>

                {/* Visual Active Tool Badges */}
                <div className="space-y-1">
                    <div className={isDark ? "text-zinc-500" : "text-zinc-400"}>• Active Skills:</div>
                    {activeTools.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-0.5 max-h-16 overflow-y-auto pr-0.5">
                            {activeTools.map((t: string) => (
                                <span key={t} className={`px-1.5 py-0.2 rounded border text-[8px] font-mono leading-none ${isDark ? "bg-blue-950/20 border-blue-900/60 text-blue-400" : "bg-blue-50 border-blue-100 text-blue-600"
                                    }`}>
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
    const isDark = data.theme === 'dark';

    const nodeStyle = isDark
        ? `bg-zinc-950/90 text-emerald-400 border-emerald-500/50 glow-neon-green`
        : `bg-white border-zinc-200 hover:border-zinc-300 text-zinc-800`;

    return (
        <div className={`px-4 py-3.5 rounded-xl border text-xs font-mono shadow-md text-left transition-all min-w-[190px] max-w-[240px] relative ${nodeStyle} ${selected
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-lg scale-[1.02]'
            : ''
            }`}>
            <div className={`absolute top-1 right-2 text-[7px] select-none uppercase tracking-widest font-black ${isDark ? "text-emerald-500 opacity-80" : "opacity-40 text-zinc-500"}`}>
                Validator
            </div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none font-bold ${isDark ? "border-zinc-800 text-zinc-200" : "border-zinc-100 text-zinc-800"}`}>
                <span>🛡️</span> {data.name?.toUpperCase() || "UNNAMED"}
            </div>
            <div className="space-y-1 text-[10px] text-zinc-500 leading-normal">
                <div className="truncate">• Target: <span className={`font-semibold px-1 py-0.5 rounded ${isDark ? "bg-zinc-900 text-zinc-350" : "bg-zinc-100 text-zinc-700"}`}>{data.target_file_key || "target_file"}</span></div>

                <div className={`pt-1.5 mt-1 border-t flex flex-col gap-0.5 text-[8px] text-zinc-400 select-none ${isDark ? "border-zinc-900" : "border-zinc-100"}`}>
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

export function GraphBuilder({ onSaveSuccess, editConfig, theme = "light" }: GraphBuilderProps) {
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

    const isDark = theme === "dark";
    const [savedAgentTemplates, setSavedAgentTemplates] = useState<any[]>([]);
    const [templateSaveStatus, setTemplateSaveStatus] = useState<string | null>(null);

    const fetchAgentTemplates = useCallback(() => {
        fetch('/api/dashboard/agent-templates')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSavedAgentTemplates(data.templates || []);
                }
            })
            .catch(err => console.error("Lỗi khi tải danh sách Agent mẫu:", err));
    }, []);

    useEffect(() => {
        fetchAgentTemplates();
    }, [fetchAgentTemplates]);

    const handleSaveAsTemplate = () => {
        if (!selectedNode) return;
        const d = selectedNode.data;
        setTemplateSaveStatus("⏳ Đang lưu...");
        fetch('/api/dashboard/agent-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: d.name,
                system_prompt: d.system_prompt,
                tools: d.tools,
                model_mode: d.model_mode
            })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setTemplateSaveStatus("✓ Đã lưu mẫu!");
                    fetchAgentTemplates();
                    setTimeout(() => setTemplateSaveStatus(null), 2500);
                } else {
                    alert("Lỗi khi lưu mẫu: " + data.error);
                    setTemplateSaveStatus(null);
                }
            })
            .catch(err => {
                alert("Lỗi kết nối: " + err.message);
                setTemplateSaveStatus(null);
            });
    };

    // Hàm đồng bộ và đổi tên Node ID vật lý của ReactFlow kèm theo cập nhật lại dây nối (Edges)
    const handleRenameNode = (oldId: string, newName: string) => {
        const cleanName = toSafeId(newName);
        if (!cleanName) return;

        // Nếu ID mới trùng với một Node khác hiện có, chỉ cập nhật tên hiển thị tạm thời
        if (nodes.some(n => n.id === cleanName && n.id !== oldId)) {
            setNodes((nds) => nds.map(n => n.id === oldId ? { ...n, data: { ...n.data, name: newName } } : n));
            return;
        }

        // Cập nhật ID vật lý của Node và tên dữ liệu đồng thời
        setNodes((nds) => nds.map(n => {
            if (n.id === oldId) {
                return {
                    ...n,
                    id: cleanName,
                    data: { ...n.data, name: cleanName }
                };
            }
            return n;
        }));

        // Giữ nguyên trạng thái chọn Node sau khi đổi ID
        if (selectedNodeId === oldId) {
            setSelectedNodeId(cleanName);
        }

        // Tự động tìm và cập nhật lại các dây nối (Edges) nguồn và đích liên quan
        setEdges((eds) => eds.map(edge => {
            let updated = false;
            const newEdge = { ...edge };
            if (edge.source === oldId) {
                newEdge.source = cleanName;
                newEdge.id = `edge-${cleanName}-${edge.target}`;
                updated = true;
            }
            if (edge.target === oldId) {
                newEdge.target = cleanName;
                newEdge.id = `edge-${newEdge.source}-${cleanName}`;
                updated = true;
            }
            return updated ? newEdge : edge;
        }));
    };

    // Hàm tạo Node từ Template đồng bộ hoàn toàn ID với tên mẫu
    const handleAddNodeFromTemplate = (templateName: string, x: number, y: number) => {
        const template = savedAgentTemplates.find(t => t.name === templateName);
        if (!template) return;

        // Chuẩn hóa tên và tự động thêm hậu tố số nếu phát hiện trùng lặp ID trên canvas
        const baseId = toSafeId(template.name);
        let id = baseId;
        let counter = 1;
        while (nodes.some(n => n.id === id)) {
            id = `${baseId}_${counter}`;
            counter++;
        }

        const newNode: Node = {
            id, // ID vật lý ReactFlow trùng khớp hoàn toàn với tên template
            position: { x, y },
            type: "agent",
            data: {
                name: id,
                type: "agent",
                system_prompt: template.system_prompt || "",
                tools: template.tools || [],
                model_mode: template.model_mode || "fast",
                theme: theme
            }
        };

        setNodes((nds) => [...nds, newNode]);
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    };
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
                labelBgStyle: { fill: isDark ? '#05050c' : '#f0fdf4', fillOpacity: 0.9, stroke: '#10b981', strokeWidth: 1, rx: 4 },
                data: { ...edge.data, pathType: "success" }
            };
        } else if (pathType === "failure") {
            return {
                ...edge,
                label: "✗ Failure",
                animated: true,
                style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4,4' },
                labelStyle: { fill: '#ef4444', fontWeight: 700, fontSize: 9 },
                labelBgStyle: { fill: isDark ? '#05050c' : '#fef2f2', fillOpacity: 0.9, stroke: '#ef4444', strokeWidth: 1, rx: 4 },
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
    }, [isDark]);

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
                model_mode: n.model_mode || "fast",
                theme: theme
            } : {
                name: n.name,
                type: "validator",
                target_file_key: n.target_file_key || "target_file",
                next_on_success: n.next_on_success || "end",
                next_on_failure: n.next_on_failure || "",
                theme: theme
            }
        }));

        const loadedEdges = t.edges.map(e => {
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
    }, [setNodes, setEdges, formatEdgeStyle, theme]);

    // Đảm bảo Node Renderer luôn cập nhật chính xác khi Theme toàn cục thay đổi
    useEffect(() => {
        setNodes((nds) => nds.map(n => ({
            ...n,
            data: { ...n.data, theme }
        })));
    }, [theme, setNodes]);

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
                            model_mode: nodeVal.model_mode || "fast",
                            theme: theme
                        } : {
                            name: nodeId,
                            type: "validator",
                            target_file_key: nodeVal.target_file_key || "target_file",
                            next_on_success: nodeVal.next_on_success || "end",
                            next_on_failure: nodeVal.next_on_failure || "",
                            theme: theme
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
    }, [editConfig, setNodes, setEdges, formatEdgeStyle, theme]);

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
                                model_mode: nodeVal.model_mode || "fast",
                                theme: theme
                            } : {
                                name: nodeId,
                                type: "validator",
                                target_file_key: nodeVal.target_file_key || "target_file",
                                next_on_success: nodeVal.next_on_success || "end",
                                next_on_failure: nodeVal.next_on_failure || "",
                                theme: theme
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
                model_mode: "fast",
                include_global_prompt: true, // <-- Thêm dòng này
                theme: theme
            } : {
                name: id,
                type: "validator",
                target_file_key: "target_file",
                next_on_success: "end",
                next_on_failure: "",
                theme: theme
            }
        };

        setNodes((nds) => [...nds, newNode]);
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    };

    const handleDragStart = (e: React.DragEvent, nodeType: string) => {
        e.dataTransfer.setData("application/reactflow", nodeType);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dragType = e.dataTransfer.getData("application/reactflow");
        if (!dragType) return;

        const reactFlowBounds = document.querySelector(".react-flow")?.getBoundingClientRect();
        if (!reactFlowBounds) return;

        const x = e.clientX - reactFlowBounds.left - 90;
        const y = e.clientY - reactFlowBounds.top - 40;

        if (dragType.startsWith("template:")) {
            const templateName = dragType.replace("template:", "");
            handleAddNodeFromTemplate(templateName, x, y);
        } else if (dragType === "agent" || dragType === "validator") {
            handleAddNode(dragType, x, y);
        }
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

    // REAL-TIME CANVAS LINTER ACCORDION
    const linterWarnings = useMemo(() => {
        const warnings: string[] = [];

        if (entryPoint && !nodes.some(n => n.id === entryPoint)) {
            warnings.push(`⚠️ Điểm khởi chạy "${entryPoint}" không khớp với bất kỳ Node ID nào.`);
        }

        nodes.forEach(n => {
            const hasIncoming = edges.some(e => e.target === n.id);
            const hasOutgoing = edges.some(e => e.source === n.id);
            if (n.id !== entryPoint && !hasIncoming && !hasOutgoing) {
                warnings.push(`⚠️ Node "${n.id.toUpperCase()}" đang bị cô lập khỏi luồng điều phối.`);
            }
        });

        nodes.forEach(n => {
            if (n.data?.type === 'validator') {
                const outEdges = edges.filter(e => e.source === n.id);
                // CHỐT CHẶN HOÀN THIỆN
                const hasSuccess = outEdges.some(e => e.data?.pathType === 'success') || n.data?.next_on_success === 'end';
                const hasFailure = outEdges.some(e => e.data?.pathType === 'failure') || (n.data?.next_on_failure && n.data.next_on_failure !== "");

                if (!hasSuccess) {
                    warnings.push(`⚠️ Validator "${n.id.toUpperCase()}" thiếu dây rẽ nhánh "✓ Success" (hoặc đích đến thành công chưa được thiết lập là "end").`);
                }
                if (!hasFailure) {
                    warnings.push(`⚠️ Validator "${n.id.toUpperCase()}" thiếu dây rẽ nhánh "✗ Failure" (Hãy nối dây tới Node xử lý lỗi).`);
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
                    model_mode: d.model_mode,
                    include_global_prompt: d.include_global_prompt !== false // <-- Thêm dòng này
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

    const handleSaveHarness = async () => {
        setSaving(true);
        setMessage(null);

        try {
            // Tải danh sách quy trình hiện tại để đối chiếu trùng lặp
            const res = await fetch('/api/dashboard/harnesses');
            const data = await res.json();
            if (data.success && Array.isArray(data.harnesses)) {
                const isDuplicate = data.harnesses.some(
                    (h: any) => h.harness_name.toLowerCase() === harnessName.toLowerCase().trim()
                );
                if (isDuplicate) {
                    const proceed = confirm(
                        `⚠️ Phát hiện quy trình tên "${harnessName}" đã tồn tại. Bạn có muốn ghi đè lên cấu hình cũ không?`
                    );
                    if (!proceed) {
                        setSaving(false);
                        return;
                    }
                }
            }
        } catch (err) {
            console.warn("Lỗi kiểm tra trùng tên sơ đồ:", err);
        }

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
            <div className={`lg:col-span-8 border rounded-2xl relative overflow-hidden shadow-xs flex flex-col h-full transition-colors duration-200 ${isDark ? "bg-[#05050c] border-zinc-850" : "bg-zinc-50 border-zinc-200"
                }`}>

                {/* 🛠️ Top Bar Controls */}
                <div className={`p-3 border-b flex flex-wrap justify-between items-center gap-2 select-none z-10 shrink-0 transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    }`}>
                    <div className="flex gap-2 flex-wrap">
                        {/* ĐỒNG BỘ THEME CHO CHỮ NÚT BẤM (Sửa triệt để lỗi mất chữ) */}
                        <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-[10px] cursor-pointer transition-colors ${isDark
                                ? "text-zinc-200 border-zinc-700 hover:bg-zinc-850 hover:text-white"
                                : "text-zinc-800 border-zinc-200 hover:bg-zinc-100"
                                }`}
                            onClick={() => handleAddNode("agent")}
                        >
                            ➕ Click thêm Agent
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-[10px] cursor-pointer transition-colors ${isDark
                                ? "text-zinc-200 border-zinc-700 hover:bg-zinc-850 hover:text-white"
                                : "text-zinc-800 border-zinc-200 hover:bg-zinc-100"
                                }`}
                            onClick={() => handleAddNode("validator")}
                        >
                            ➕ Click thêm Validator
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className={`h-7 text-[10px] cursor-pointer transition-colors ${isDark
                                ? "text-red-400 border-red-900/60 hover:bg-red-950/30"
                                : "text-red-655 border-red-200 hover:bg-red-50"
                                }`}
                            onClick={handleResetCanvas}
                        >
                            🧹 Dọn Canvas
                        </Button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            onChange={(e) => {
                                if (e.target.value) handleLoadTemplate(e.target.value as any);
                            }}
                            defaultValue=""
                            className={`h-7 px-2.5 border rounded text-[10px] font-bold outline-none cursor-pointer transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-white border-zinc-200 text-zinc-750"
                                }`}
                        >
                            <option value="" disabled>-- Chọn Sơ đồ mẫu --</option>
                            <option value="bug_fixer">🐞 Mẫu: Bug-Fixer Loop</option>
                            <option value="security_scanner">🛡️ Mẫu: Secure-Scanner</option>
                            <option value="doc_generator">📖 Mẫu: Doc-Generator</option>
                        </select>

                        <button
                            type="button"
                            onClick={handleImportJSONClick}
                            className={`px-2.5 py-1 border rounded text-[10px] font-bold cursor-pointer transition-colors shadow-3xs ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-300 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                                }`}
                        >
                            📤 Upload JSON
                        </button>
                        <button
                            type="button"
                            onClick={handleExportJSON}
                            className={`px-2.5 py-1 border rounded text-[10px] font-bold cursor-pointer transition-colors shadow-3xs ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-300 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                                }`}
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
                        className={isDark ? 'bg-[#05050c]' : 'bg-[#f4f4f5]'}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background color={isDark ? '#312e81' : '#cbd5e1'} gap={16} size={1} />
                        <Controls className={isDark ? 'bg-zinc-900 border border-zinc-800 text-zinc-100' : 'bg-white border border-zinc-200 text-zinc-800'} />
                        <MiniMap className={isDark ? 'bg-zinc-900/90 border border-zinc-800' : 'bg-white/90 border border-zinc-200'} />
                    </ReactFlow>

                    {/* FLOATING DRAG PALETTE ON CANVAS */}
                    <div className={`absolute bottom-4 left-4 z-20 border shadow-xl rounded-xl p-3.5 flex flex-col gap-2 select-none pointer-events-auto transition-colors max-w-sm ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white/95 border-zinc-200"
                        }`}>
                        <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block text-left mb-1">
                            Kéo vật liệu vào Sơ đồ
                        </span>
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, "agent")}
                                className={`px-3 py-2 border rounded-lg text-xs font-mono font-bold cursor-grab active:cursor-grabbing flex items-center gap-1.5 shadow-3xs transition-colors ${isDark ? "bg-blue-950/20 border-blue-900/60 text-blue-400 hover:bg-blue-900/10" : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                                    }`}
                                title="Kéo thả Agent mặc định"
                            >
                                <span>🤖</span> Agent
                            </div>
                            <div
                                draggable
                                onDragStart={(e) => handleDragStart(e, "validator")}
                                className={`px-3 py-2 border rounded-lg text-xs font-mono font-bold cursor-grab active:cursor-grabbing flex items-center gap-1.5 shadow-3xs transition-colors ${isDark ? "bg-emerald-950/20 border-emerald-900/60 text-emerald-400 hover:bg-emerald-900/10" : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                    }`}
                                title="Kéo thả Validator mặc định"
                            >
                                <span>🛡️</span> Validator
                            </div>

                            {/* Render danh sách Agent cá nhân đã lưu */}
                            {savedAgentTemplates.map((template) => (
                                <div
                                    key={template.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, `template:${template.name}`)}
                                    className={`px-3 py-2 border rounded-lg text-xs font-mono font-bold cursor-grab active:cursor-grabbing flex items-center gap-1.5 shadow-3xs transition-colors group relative ${isDark
                                        ? "bg-purple-950/20 border-purple-900/60 text-purple-400 hover:bg-purple-900/10"
                                        : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                        }`}
                                    title={`Mẫu Agent: ${template.name}`}
                                >
                                    <span>🧠</span> {template.name}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Bạn có chắc muốn xóa mẫu Agent "${template.name}"?`)) {
                                                fetch(`/api/dashboard/agent-templates/${template.id}`, { method: 'DELETE' })
                                                    .then(res => res.json())
                                                    .then(data => {
                                                        if (data.success) {
                                                            fetchAgentTemplates();
                                                        }
                                                    });
                                            }
                                        }}
                                        className="text-[9px] text-red-500 hover:text-red-700 ml-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-bold select-none border-none bg-transparent"
                                        title="Xóa mẫu này"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* CỘT PHẢI: CONFIG PANEL SIDEBAR */}
            <div className={`lg:col-span-4 border rounded-2xl p-4 flex flex-col h-full overflow-y-auto space-y-4 font-sans select-none transition-colors duration-200 ${isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
                }`}>

                {/* 1. Thiết lập chung */}
                <div className={`space-y-3 p-4 rounded-xl border shadow-3xs text-left select-text transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider select-none border-b pb-1 ${isDark ? "text-zinc-400 border-zinc-800" : "text-zinc-500 border-zinc-200"}`}>⚙️ Cài đặt chung (Harness)</h3>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Tên Quy Trình (Harness Key)</label>
                        <input
                            type="text"
                            value={harnessName}
                            onChange={(e) => setHarnessName(e.target.value)}
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-semibold outline-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                }`}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Mô tả quy trình</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs outline-none transition-colors resize-none leading-relaxed ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                }`}
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Điểm khởi chạy (Entry Point Node ID)</label>
                        <input
                            type="text"
                            value={entryPoint}
                            onChange={(e) => setEntryPoint(e.target.value)}
                            placeholder="planner"
                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-semibold outline-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                }`}
                        />
                    </div>
                </div>

                {/* REAL-TIME CANVAS LINTER ACCORDION */}
                {linterWarnings.length > 0 && (
                    <div className={`p-3.5 border rounded-xl space-y-1.5 text-left shrink-0 transition-colors ${isDark ? "bg-red-950/20 border-red-900/40 text-rose-400" : "bg-rose-50 border-rose-200 text-rose-700"
                        }`}>
                        <span className="text-[8px] font-bold text-rose-500 uppercase tracking-widest block select-none">
                            🚨 Trình kiểm duyệt lỗi sơ đồ (Live Linter)
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
                            {linterWarnings.map((w, wIdx) => (
                                <p key={wIdx} className={`text-[10px] leading-normal font-medium select-text ${isDark ? "text-rose-300" : "text-rose-700"}`}>
                                    {w}
                                </p>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Cấu hình phần tử đang chọn (Node / Edge) */}
                <div className={`flex-1 p-4 rounded-xl border shadow-3xs flex flex-col text-left select-text min-h-[300px] transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    }`}>

                    {/* NODE CONFIGURATION PANEL */}
                    {selectedNode && (
                        <div className="space-y-4 flex-1 flex flex-col overflow-y-auto">
                            <div className={`flex justify-between items-center select-none border-b pb-1.5 shrink-0 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${selectedNode.data.type === 'agent'
                                    ? (isDark ? "bg-blue-950/20 border-blue-900/40 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600")
                                    : (isDark ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600")
                                    }`}>
                                    {selectedNode.data.type} Node
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {selectedNode.data.type === 'agent' && (
                                        <button
                                            type="button"
                                            onClick={handleSaveAsTemplate}
                                            className={`px-2 py-1 rounded border text-[9px] font-bold cursor-pointer transition-colors ${isDark
                                                ? "bg-purple-950/30 border-purple-900/60 text-purple-400 hover:bg-purple-900/30"
                                                : "bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100"
                                                }`}
                                        >
                                            {templateSaveStatus || "💾 Lưu mẫu"}
                                        </button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={handleDeleteNode} className="h-6 text-[9px] text-red-655 hover:bg-red-50 cursor-pointer">
                                        🗑️ Xóa Node
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1 shrink-0">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Node ID (Khóa định danh)</label>
                                <input
                                    type="text"
                                    value={selectedNode.data.name}
                                    onChange={(e) => handleRenameNode(selectedNode.id, e.target.value)}
                                    className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-semibold outline-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                        }`}
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
                                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-semibold outline-none cursor-pointer transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-300 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-700 focus:border-zinc-300"
                                                }`}
                                        >
                                            <option value="fast">⚡ Fast (Mô hình xử lý nhanh)</option>
                                            <option value="thinking">🧠 DeepThink (Suy nghĩ sâu)</option>
                                        </select>
                                    </div>
                                    <div className={`space-y-1.5 shrink-0 flex items-center justify-between p-2.5 rounded-lg border transition-colors ${isDark ? "bg-zinc-950 border-zinc-850" : "bg-zinc-50 border-zinc-150"}`}>
                                        <label htmlFor="include-global-prompt-chk" className="text-[10px] font-bold text-zinc-450 uppercase cursor-pointer select-none">
                                            Kế thừa system_prompt.md toàn cục
                                        </label>
                                        <input
                                            id="include-global-prompt-chk"
                                            type="checkbox"
                                            checked={selectedNode.data.include_global_prompt !== false}
                                            onChange={(e) => handleUpdateSelectedNodeData({ include_global_prompt: e.target.checked })}
                                            className="w-3.5 h-3.5 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 cursor-pointer"
                                        />
                                    </div>
                                    <div className="space-y-1 flex-1 flex flex-col min-h-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">System Prompt (Chỉ thị hệ thống)</label>
                                        <textarea
                                            value={selectedNode.data.system_prompt || ""}
                                            onChange={(e) => handleUpdateSelectedNodeData({ system_prompt: e.target.value })}
                                            placeholder="Bạn là chuyên gia... Đọc bối cảnh sau: ${state.last_output}"
                                            className={`w-full flex-1 p-2 border rounded-lg text-xs outline-none font-mono leading-relaxed transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-250 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                                }`}
                                        />
                                    </div>

                                    {/* THẺ KÉN QUẤN DÒNG TOOLS (Pill Tags) */}
                                    <div className="space-y-1.5 shrink-0">
                                        <label className="text-[10px] font-bold text-zinc-400 uppercase">Năng lực gán (Tools)</label>
                                        <div className={`p-2.5 border rounded-lg max-h-40 overflow-y-auto flex flex-wrap gap-1.5 select-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
                                            }`}>
                                            {availableSkills.map(skill => {
                                                const isChecked = selectedNode.data.tools?.includes(skill.name);
                                                return (
                                                    <button
                                                        key={skill.name}
                                                        type="button"
                                                        onClick={() => {
                                                            const currentTools = selectedNode.data.tools || [];
                                                            const nextTools = isChecked
                                                                ? currentTools.filter((t: string) => t !== skill.name)
                                                                : [...currentTools, skill.name];
                                                            handleUpdateSelectedNodeData({ tools: nextTools });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-full border text-[10px] font-mono transition-all cursor-pointer flex items-center gap-1 leading-none h-6 ${isChecked
                                                            ? (isDark
                                                                ? 'bg-blue-600 border-blue-600 text-white font-bold'
                                                                : 'bg-blue-600 border-blue-600 text-white font-bold shadow-3xs')
                                                            : (isDark
                                                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                                                                : 'bg-zinc-50 border-zinc-200 text-zinc-655 hover:bg-zinc-100 hover:text-zinc-850')
                                                            }`}
                                                    >
                                                        <span className="text-[8px] font-bold select-none">{isChecked ? "✓" : "+"}</span>
                                                        {skill.name}
                                                    </button>
                                                );
                                            })}
                                            {availableSkills.length === 0 && (
                                                <span className="text-zinc-500 italic text-[10px]">Không tìm thấy skills khả dụng</span>
                                            )}
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
                                            className={`w-full px-2.5 py-1.5 border rounded-lg text-xs font-mono font-semibold transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                                }`}
                                        />
                                    </div>

                                    <div className={`p-3 border rounded-xl space-y-1.5 transition-colors ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                                        }`}>
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
                            <div className={`flex justify-between items-center select-none border-b pb-1.5 shrink-0 ${isDark ? "border-zinc-800" : "border-zinc-100"}`}>
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
                            <div className={`space-y-2 pt-2 border-t ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                                <label className="text-[10px] font-bold text-zinc-400 uppercase">Cấu hình rẽ nhánh điều kiện</label>
                                <div className="flex flex-col gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchEdgeType("default")}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${!selectedEdge.data?.pathType || selectedEdge.data?.pathType === 'default'
                                            ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                                            : (isDark ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50")
                                            }`}
                                    >
                                        🔵 Connection thông thường
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchEdgeType("success")}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${selectedEdge.data?.pathType === 'success'
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-bold'
                                            : (isDark ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50")
                                            }`}
                                    >
                                        🟢 Success Path (Khi xác thực thành công)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSwitchEdgeType("failure")}
                                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${selectedEdge.data?.pathType === 'failure'
                                            ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                                            : (isDark ? "bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800" : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50")
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