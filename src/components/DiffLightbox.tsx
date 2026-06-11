// filepath: bridge_client/src/components/DiffLightbox.tsx
import * as React from "react";
import { useEffect } from "react";

interface DiffLightboxProps {
    selectedDiff: {
        file: string;
        absolute_path: string;
        diff: string;
        latest_diff?: string;
    };
    diffMode: 'cumulative' | 'latest';
    onClose: () => void;
    onChangeDiffMode: (mode: 'cumulative' | 'latest') => void;
    highlightCodeLine: (code: string) => string;
}

export function DiffLightbox({ selectedDiff, diffMode, onClose, onChangeDiffMode, highlightCodeLine }: DiffLightboxProps) {
    useEffect(() => {
        const timer = setTimeout(() => {
            const firstChangeEl = document.querySelector('.diff-line-add, .diff-line-del');
            if (firstChangeEl) {
                firstChangeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
        return () => clearTimeout(timer);
    }, [selectedDiff, diffMode]);

    const targetDiff = diffMode === 'latest'
        ? (selectedDiff.latest_diff || selectedDiff.diff)
        : selectedDiff.diff;

    const allLines = targetDiff ? targetDiff.split('\n') : [];
    const changeIndices: number[] = [];

    allLines.forEach((line, idx) => {
        const isAdd = line.startsWith('+') && !line.startsWith('+++');
        const isDel = line.startsWith('-') && !line.startsWith('---');
        if (isAdd || isDel) {
            changeIndices.push(idx);
        }
    });

    const visibleIndices = new Set<number>();
    const CONTEXT_SIZE = 3;

    changeIndices.forEach(changeIdx => {
        for (let i = Math.max(0, changeIdx - CONTEXT_SIZE); i <= Math.min(allLines.length - 1, changeIdx + CONTEXT_SIZE); i++) {
            visibleIndices.add(i);
        }
    });

    const renderLines: any[] = [];
    let prevVisibleIdx = -10;

    Array.from(visibleIndices).sort((a, b) => a - b).forEach((idx) => {
        if (idx - prevVisibleIdx > 1) {
            renderLines.push(
                <div key={`ellipsis-${idx}`} className="py-1 px-3 text-zinc-500 text-xs select-none">
                    ... ({idx - prevVisibleIdx - 1} dòng không thay đổi đã được ẩn)
                </div>
            );
        }

        const line = allLines[idx];
        const isAdd = line.startsWith('+') && !line.startsWith('+++');
        const isDel = line.startsWith('-') && !line.startsWith('---');

        let colorClass = "text-zinc-500 opacity-80";
        let bgClass = "pl-3";

        if (isAdd) {
            colorClass = "text-emerald-400 font-semibold diff-line-add";
            bgClass = "bg-emerald-950/45 border-l-2 border-emerald-500 pl-3";
        } else if (isDel) {
            colorClass = "text-rose-400 font-semibold diff-line-del";
            bgClass = "bg-rose-950/45 border-l-2 border-rose-500 pl-3";
        } else {
            bgClass = "pl-3 opacity-80";
        }

        const codeContent = (isAdd || isDel) ? line.substring(1) : line;
        const highlightedHtml = highlightCodeLine(codeContent);

        renderLines.push(
            <div key={idx} className={`whitespace-pre py-0.5 leading-normal ${bgClass} ${colorClass}`}>
                {isAdd && <span className="text-emerald-500 font-bold mr-1 select-none">+ </span>}
                {isDel && <span className="text-rose-500 font-bold mr-1 select-none">- </span>}
                <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
            </div>
        );

        prevVisibleIdx = idx;
    });

    return (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 select-text">
            <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl h-[80vh] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-zinc-800">
                <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center select-none shrink-0">
                    <div className="text-left max-w-[50%]">
                        <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                            <span>📊</span> So sánh chi tiết tệp Sandbox
                        </h3>
                        <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate" title={selectedDiff.absolute_path}>
                            {selectedDiff.absolute_path}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-zinc-100 rounded-lg border border-zinc-200 p-0.5">
                            <button
                                type="button"
                                onClick={() => onChangeDiffMode('latest')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${diffMode === 'latest'
                                    ? 'bg-white text-zinc-800 shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-600'
                                    }`}
                            >
                                Lần sửa gần nhất
                            </button>
                            <button
                                type="button"
                                onClick={() => onChangeDiffMode('cumulative')}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${diffMode === 'cumulative'
                                    ? 'bg-white text-zinc-800 shadow-xs'
                                    : 'text-zinc-400 hover:text-zinc-600'
                                    }`}
                            >
                                Lũy kế phiên
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="px-3.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer transition-colors"
                        >
                            Đóng [Esc]
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-zinc-900 text-zinc-100 font-mono text-sm leading-relaxed text-left">
                    {allLines.length > 0 ? (
                        <div className="font-mono space-y-0.5">{renderLines}</div>
                    ) : (
                        <div className="text-zinc-400 italic text-center py-20">
                            Không phát hiện thay đổi nào thuộc chế độ xem này.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}