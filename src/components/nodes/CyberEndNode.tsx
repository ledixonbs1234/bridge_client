// ridge_client/src/components/nodes/CyberEndNode.tsx
import * as React from "react";
import { Handle, Position } from "reactflow";

interface CyberEndNodeProps {
    data: {
        theme?: "light" | "dark";
    };
}

export const CyberEndNode = React.memo(({ data }: CyberEndNodeProps) => {
    const isDark = data.theme !== 'light';
    return (
        <div className={`px-4 py-2.5 rounded-full border text-xs font-mono font-bold shadow-md text-center transition-all select-none min-w-[110px] relative ${isDark
                ? 'bg-zinc-950/90 border-rose-500/50 text-rose-400 glow-neon-magenta'
                : 'bg-white border-rose-200 text-rose-600 shadow-sm'
            }`}>
            🛑 END FLOW
            <Handle type="target" position={Position.Left} style={{ background: '#f43f5e', width: '8px', height: '8px' }} />
        </div>
    );
});

CyberEndNode.displayName = "CyberEndNode";