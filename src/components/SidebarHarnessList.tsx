// filepath: bridge_client/src/components/SidebarHarnessList.tsx
import * as React from "react";

interface HarnessItem {
    id: string;
    harness_name: string;
    nodes_count: number;
    initial_node: string;
}

interface SidebarHarnessListProps {
    harnesses: HarnessItem[];
    onRun: (harnessId: string) => void;
    onEdit: (harnessId: string) => void;
    onDelete: (harnessId: string, displayName: string) => void;
}

export function SidebarHarnessList({ harnesses, onRun, onEdit, onDelete }: SidebarHarnessListProps) {
    return (
        <div className="space-y-1.5 pt-3 border-t border-zinc-200 mt-2 text-left select-none">
            <span className="px-3 text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Saved FSM Workflows</span>
            {harnesses.length === 0 ? (
                <div className="px-3 py-2 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-[10px] text-zinc-400 italic font-medium">Chưa có FSM sơ đồ nào.</p>
                </div>
            ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {harnesses.map((h) => (
                        <div
                            key={h.id}
                            className="bg-white border border-zinc-200 rounded-xl p-2.5 shadow-3xs flex items-center justify-between group hover:border-zinc-300 hover:shadow-2xs transition-all"
                        >
                            <div className="flex-1 truncate mr-1 text-left">
                                <span className="text-[11px] font-bold text-zinc-700 truncate block" title={h.harness_name}>
                                    📐 {h.harness_name}
                                </span>
                                <span className="text-[9px] text-zinc-400 font-mono block mt-0.5">
                                    {h.nodes_count} nodes • Entry: {h.initial_node}
                                </span>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    onClick={() => onRun(h.id)}
                                    className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg text-xs border-none bg-transparent cursor-pointer transition-colors"
                                    title={`Kích hoạt và chạy sơ đồ '${h.harness_name}'`}
                                >
                                    ▶
                                </button>
                                <button
                                    onClick={() => onEdit(h.id)}
                                    className="p-1 hover:bg-blue-50 text-blue-500 rounded-lg text-xs border-none bg-transparent cursor-pointer transition-colors"
                                    title={`Chỉnh sửa sơ đồ '${h.harness_name}'`}
                                >
                                    ✏️
                                </button>
                                <button
                                    onClick={() => onDelete(h.id, h.harness_name)}
                                    className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg text-xs border-none bg-transparent cursor-pointer transition-colors"
                                    title={`Xóa vĩnh viễn sơ đồ '${h.harness_name}'`}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}