// filepath: bridge_client/src/components/terminal/AiOutputPanel.tsx
import * as React from "react";
import { useEffect, useRef } from "react";
import { TimelineTextBlock } from "./TimelineTextBlock";

interface AiOutputPanelProps {
    lastAssistantMessage: { content: string } | undefined;
    showResponsePanel: boolean;
    setShowResponsePanel: (show: boolean) => void;
    panelWidth: number;
    panelHeight: number;
    setPanelWidth: (w: number) => void;
    setPanelHeight: (h: number) => void;
    isPinned: boolean;
    setIsPinned: (pinned: boolean) => void;
    theme: "light" | "dark";
    toggleBtnRef: React.RefObject<HTMLButtonElement | null>;
}

export function AiOutputPanel({
    lastAssistantMessage,
    showResponsePanel,
    setShowResponsePanel,
    panelWidth,
    panelHeight,
    setPanelWidth,
    setPanelHeight,
    isPinned,
    setIsPinned,
    theme,
    toggleBtnRef
}: AiOutputPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

    // Tính năng Tự động ẩn khi nhấp chuột ra ngoài (Click Outside) - Chỉ hoạt động khi CHƯA PIN
    useEffect(() => {
        if (!showResponsePanel || isPinned) return;

        const handleOutsideClick = (e: PointerEvent) => {
            const target = e.target as Node;

            // Bỏ qua nếu người dùng bấm vào chính nó hoặc nút Toggle
            const isClickInsidePanel = panelRef.current?.contains(target);
            const isClickOnToggleButton = toggleBtnRef.current?.contains(target);

            if (!isClickInsidePanel && !isClickOnToggleButton) {
                setShowResponsePanel(false);
            }
        };

        document.addEventListener("pointerdown", handleOutsideClick);
        return () => document.removeEventListener("pointerdown", handleOutsideClick);
    }, [showResponsePanel, isPinned, setShowResponsePanel, toggleBtnRef]);

    // Thao tác kéo giãn kích thước (Resize Panel)
    const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        resizeStart.current = {
            x: e.clientX,
            y: e.clientY,
            w: panelWidth,
            h: panelHeight
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!resizeStart.current) return;
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;

        const newWidth = Math.max(280, Math.min(950, resizeStart.current.w - deltaX));
        const newHeight = Math.max(160, Math.min(800, resizeStart.current.h + deltaY));

        setPanelWidth(newWidth);
        setPanelHeight(newHeight);
    };

    const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        resizeStart.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    if (!showResponsePanel || !lastAssistantMessage) return null;

    const isDark = theme === "dark";

    // Panel nội dung giờ đây giữ giao diện phẳng tĩnh bám sát theme (Bỏ animate-pulse)
    const alertBorderClass = isDark ? "border-zinc-800 shadow-2xl" : "border-zinc-200 shadow-2xl";

    return (
        <div
            ref={panelRef}
            style={{ width: `${panelWidth}px`, height: `${panelHeight}px` }}
            className={`absolute top-4 right-4 z-40 rounded-xl p-4 backdrop-blur-md text-left pointer-events-auto select-text relative flex flex-col transition-all duration-300 ${alertBorderClass} ${isDark ? "bg-zinc-950/95 text-zinc-200" : "bg-white/95 text-zinc-800"
                }`}
        >
            {/* Header: Title & Pin Action */}
            <div className={`flex justify-between items-center pb-2 mb-2 border-b select-none shrink-0 ${isDark ? "border-zinc-800" : "border-zinc-200"
                }`}>
                <h3 className={`text-[10px] font-bold uppercase tracking-widest font-mono flex items-center gap-1.5 ${isDark ? "text-zinc-400" : "text-zinc-650"
                    }`}>
                    <span>🤖</span> Latest Assistant Output
                </h3>

                {/* NÚT PIN TÍNH NĂNG */}
                <button
                    type="button"
                    onClick={() => setIsPinned(!isPinned)}
                    className={`p-1 px-2 rounded-md text-[9px] font-bold font-mono transition-colors flex items-center gap-1 cursor-pointer border ${isPinned
                        ? "bg-cyan-500/10 border-cyan-500 text-cyan-400 font-extrabold"
                        : isDark ? "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-500 hover:text-zinc-800"
                        }`}
                    title={isPinned ? "Bỏ ghim (Bảng sẽ ẩn khi nhấp ra ngoài)" : "Ghim bảng (Giữ bảng luôn nổi)"}
                >
                    📌 {isPinned ? "PINNED" : "PIN"}
                </button>
            </div>

            {/* Scrollable Output Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin pr-1 select-text">
                <TimelineTextBlock content={lastAssistantMessage.content} theme={theme} />
            </div>

            {/* Drag handle to resize panel */}
            <div
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                className="absolute bottom-1 left-1 w-5 h-5 cursor-nesw-resize flex items-end justify-start p-0.5 select-none z-50 group/resize pointer-events-auto"
                style={{ touchAction: "none" }}
                title="Kéo thả để chỉnh kích thước"
            >
                <svg width="10" height="10" viewBox="0 0 10 10" className={`text-zinc-500 group-hover/resize:text-cyan-400 transition-colors`}>
                    <line x1="0" y1="10" x2="10" y2="0" stroke="currentColor" strokeWidth="1.5" />
                    <line x1="0" y1="5" x2="5" y2="0" stroke="currentColor" strokeWidth="1" />
                </svg>
            </div>
        </div>
    );
}