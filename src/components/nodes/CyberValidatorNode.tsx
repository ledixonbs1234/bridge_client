// filepath: ridge_client/src/components/nodes/CyberValidatorNode.tsx
import * as React from "react";
import { Handle, Position } from "reactflow";

interface CyberValidatorNodeProps {
    data: {
        theme?: "light" | "dark";
        name: string;
        state: "passed" | "failed" | "blocked" | "validating" | string;
    };
}

export const CyberValidatorNode = React.memo(({ data }: CyberValidatorNodeProps) => {
    const isDark = data.theme !== 'light';
    const isFailed = data.state === "failed" || data.state === "blocked";

    let borderGlowClass = "";
    if (isDark) {
        borderGlowClass = isFailed
            ? "glow-neon-magenta border-red-500 text-red-500 bg-zinc-950/90"
            : data.state === "passed"
                ? "glow-neon-green border-emerald-400 text-emerald-400 bg-zinc-950/90"
                : "glow-neon-cyan border-cyan-400 text-cyan-400 bg-zinc-950/90";
    } else {
        borderGlowClass = isFailed
            ? "border-red-500 text-red-600 bg-white/95 shadow-md"
            : data.state === "passed"
                ? "border-emerald-500 text-emerald-600 bg-white/95 shadow-md"
                : "border-cyan-500 text-cyan-600 bg-white/95 shadow-md";
    }

    const stateColor = isFailed
        ? "text-red-500 font-bold animate-pulse"
        : data.state === "passed"
            ? "text-emerald-500 font-bold"
            : "text-cyan-500 animate-pulse font-bold";

    const borderLineColor = isDark ? "border-zinc-800" : "border-zinc-200";

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono shadow-lg relative min-w-[200px] max-w-[260px] text-left transition-all duration-200 ${borderGlowClass}`}>
            <div className={`absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black opacity-80 ${isDark ? "" : "text-zinc-500"}`}>
                Strict Quality Gate
            </div>
            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none ${borderLineColor}`}>
                <span>🛡️</span> {data.name}
            </div>
            <div className="space-y-1">
                <div className={`text-[9px] mt-1 pt-1 flex justify-between select-none ${borderLineColor}`}>
                    <span className={isDark ? "text-zinc-500" : "text-zinc-400"}>Verdict:</span>
                    <span className={stateColor}>{data.state?.toUpperCase()}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Left} style={{ background: '#ff007f', width: '8px', height: '8px' }} />
            <Handle type="source" position={Position.Right} style={{ background: '#ff007f', width: '8px', height: '8px' }} />
        </div>
    );
});

CyberValidatorNode.displayName = "CyberValidatorNode";