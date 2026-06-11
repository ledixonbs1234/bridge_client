// filepath: bridge_client/src/components/SidebarShadowChanges.tsx
import * as React from "react";

interface ShadowChangeItem {
    id?: string;
    file: string;
    absolute_path: string;
    additions: number;
    deletions: number;
}

interface SidebarShadowChangesProps {
    shadowChanges: ShadowChangeItem[];
    onViewDiff: (change: any) => void;
    onRollback: (file?: string) => void;
}

export function SidebarShadowChanges({ shadowChanges, onViewDiff, onRollback }: SidebarShadowChangesProps) {
    return (
        <div className="space-y-1.5 pt-1 text-left select-none">
            <div className="flex justify-between items-center px-3 mb-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Shadow Changes</span>
                {shadowChanges.length > 0 && (
                    <button
                        onClick={() => onRollback()}
                        className="text-[9px] text-red-600 hover:underline font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
                        title="Khôi phục tất cả các tệp về nguyên trạng"
                    >
                        ↩️ Reset All
                    </button>
                )}
            </div>

            {shadowChanges.length === 0 ? (
                <div className="px-3 py-3 bg-white border border-zinc-200 rounded-xl">
                    <p className="text-[10px] text-zinc-400 italic font-medium">Không có thay đổi nào.</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {shadowChanges.map((change) => (
                        <div
                            key={change.id || change.file}
                            className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs flex items-center justify-between group hover:border-zinc-300 hover:shadow-xs transition-all"
                        >
                            <button
                                onClick={() => onViewDiff(change)}
                                className="flex-1 text-left flex flex-col transition-colors text-[11px] font-mono cursor-pointer border-none bg-transparent truncate"
                            >
                                <span className="text-zinc-750 font-bold truncate block" title={change.file}>
                                    {change.file.split('/').pop()}
                                </span>
                                <span className="text-[9px] text-zinc-400 mt-0.5 flex gap-1.5">
                                    {change.additions > 0 && <span className="text-emerald-600 font-bold">+{change.additions}</span>}
                                    {change.deletions > 0 && <span className="text-rose-600 font-bold">-{change.deletions}</span>}
                                    {change.additions === 0 && change.deletions === 0 && <span className="text-zinc-400">chưa thay đổi</span>}
                                </span>
                            </button>
                            <button
                                onClick={() => onRollback(change.file)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 rounded-lg text-xs border-none bg-transparent cursor-pointer transition-opacity"
                                title={`Khôi phục tệp ${change.file.split('/').pop()} về nguyên trạng`}
                            >
                                ↩️
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}