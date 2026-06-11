// filepath: ridge_client/src/components/nodes/CyberGroupNode.tsx
import * as React from "react";

interface CyberGroupNodeProps {
    data: {
        theme?: "light" | "dark";
        label: string;
        width: number;
        height: number;
    };
}

export const CyberGroupNode = React.memo(({ data }: CyberGroupNodeProps) => {
    const isDark = data.theme !== 'light';
    return (
        <div
            style={{ width: data.width, height: data.height }}
            className={`rounded-2xl border pointer-events-none select-none p-3 text-left transition-all duration-200 ${isDark
                ? 'bg-zinc-950/20 border-zinc-800/40 text-zinc-550'
                : 'bg-zinc-100/30 border-zinc-200/60 text-zinc-400'
                }`}
        >
            <div className={`absolute top-2.5 left-4 text-[9px] font-bold font-mono uppercase tracking-wider ${isDark ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                {data.label}
            </div>
        </div>
    );
});

CyberGroupNode.displayName = "CyberGroupNode";