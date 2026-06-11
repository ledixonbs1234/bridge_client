// filepath: ridge_client/src/components/nodes/CyberUserNode.tsx
import * as React from "react";
import { Handle, Position } from "reactflow";

interface CyberUserNodeProps {
    data: {
        theme?: "light" | "dark";
        content: string;
        images?: string[];
    };
}

export const CyberUserNode = React.memo(({ data }: CyberUserNodeProps) => {
    const [copied, setCopied] = React.useState(false); // Quản lý trạng thái copy cục bộ
    const isDark = data.theme !== 'light';
    const bgClass = isDark
        ? "bg-zinc-950/90 text-cyan-400 border-cyan-400 glow-neon-cyan"
        : "bg-white/95 text-cyan-600 border-cyan-400 shadow-md";
    const contentColor = isDark ? "text-zinc-300" : "text-zinc-700";

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation(); // Ngăn mở bảng Inspector khi bấm vào nút sao chép [5]
        navigator.clipboard.writeText(data.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className={`px-4 py-3 rounded-xl border text-xs font-mono font-bold relative min-w-[200px] max-w-[260px] text-left transition-all duration-200 group ${bgClass}`}>
            <div className={`absolute top-0.5 right-2 text-[7px] select-none uppercase tracking-widest font-black ${isDark ? "text-cyan-500" : "text-cyan-600"}`}>User Input</div>

            {/* NÚT COPY TRÊN FLOWCHART NODE */}
            <button
                type="button"
                onClick={handleCopy}
                className={`absolute top-1.5 right-14 p-1 rounded border opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10 flex items-center justify-center ${isDark
                    ? "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50"
                    }`}
                title="Sao chép câu hỏi"
            >
                {copied ? (
                    <span className="text-[9px] text-emerald-500 font-bold px-0.5">✓</span>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                )}
            </button>

            <div className={`border-b pb-1 mb-1.5 flex items-center gap-1.5 select-none ${isDark ? "border-cyan-500/20" : "border-cyan-200"}`}>
                <span>💬</span> PROMPT DECK
            </div>
            <div className={`text-[11px] font-semibold line-clamp-3 select-text whitespace-pre-wrap leading-relaxed ${contentColor}`}>
                {data.content}
            </div>
            {data.images && data.images.length > 0 && (
                <div className="mt-1.5 flex gap-1 select-none">
                    {data.images.map((img: string, idx: number) => (
                        <img key={idx} src={img} className={`w-8 h-8 rounded border object-cover ${isDark ? "border-cyan-400/30" : "border-cyan-300"}`} alt="pasted" />
                    ))}
                </div>
            )}
            <Handle type="source" position={Position.Right} style={{ background: isDark ? '#00f0ff' : '#0ea5e9', borderColor: isDark ? '#00f0ff' : '#0ea5e9', width: '8px', height: '8px' }} />
        </div>
    );
});

CyberUserNode.displayName = "CyberUserNode";