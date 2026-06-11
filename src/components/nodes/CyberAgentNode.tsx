// filepath: ridge_client/src/components/nodes/CyberAgentNode.tsx
import * as React from "react";
import { Handle, Position } from "reactflow";

interface CyberAgentNodeProps {
    data: {
        theme?: "light" | "dark";
        name: string;
        role: string;
        model: string;
        state: "running" | "thinking" | "completed" | string;
        content?: string;
    };
}

export const CyberAgentNode = React.memo(({ data }: CyberAgentNodeProps) => {
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
});

CyberAgentNode.displayName = "CyberAgentNode";