// filepath: ridge_client/src/components/nodes/CyberToolNode.tsx
import * as React from "react";
import { Handle, Position } from "reactflow";

interface CyberToolNodeProps {
    data: {
        theme?: "light" | "dark";
        tool: string;
        title: string;
        state: "failed" | "completed" | "running" | string;
        input?: string;
        output?: string;
    };
}

export const CyberToolNode = React.memo(({ data }: CyberToolNodeProps) => {
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
});

CyberToolNode.displayName = "CyberToolNode";