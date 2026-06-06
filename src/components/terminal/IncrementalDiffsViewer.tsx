// filepath: ridge_client/src/components/terminal/IncrementalDiffsViewer.tsx
import * as React from "react";
import { useState } from "react";
import { highlightCodeLine } from "../../lib/utils";

interface IncrementalDiff {
    file: string;
    additions: number;
    deletions: number;
    diff: string;
}

interface IncrementalDiffsViewerProps {
    diffs: IncrementalDiff[];
}

export const IncrementalDiffsViewer = React.memo(function IncrementalDiffsViewer({ diffs }: IncrementalDiffsViewerProps) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggleExpand = (filePath: string) => {
        setExpanded(prev => ({ ...prev, [filePath]: !prev[filePath] }));
    };

    return (
        <div className="space-y-2 select-text w-full text-left">
            {diffs.map((d, dIdx) => {
                const isExpanded = !!expanded[d.file];
                const fileName = d.file.split('/').pop() || '';
                const lines = d.diff ? d.diff.split('\n') : [];

                return (
                    <div key={dIdx} className="border border-zinc-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                        <button
                            type="button"
                            onClick={() => toggleExpand(d.file)}
                            className="w-full flex items-center justify-between p-2.5 bg-zinc-50/50 hover:bg-zinc-100/60 text-left transition-colors cursor-pointer select-none border-none"
                        >
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-xs">📝</span>
                                <span className="text-[11px] font-bold text-zinc-700 font-mono truncate" title={d.file}>
                                    Thay đổi: {fileName}
                                </span>
                                <span className="text-[9px] font-mono font-bold flex gap-1 bg-white border border-zinc-200 px-1.5 py-0.2 rounded shadow-3xs">
                                    {d.additions > 0 && <span className="text-emerald-600 font-bold">+{d.additions}</span>}
                                    {d.deletions > 0 && <span className="text-rose-600 font-bold">-{d.deletions}</span>}
                                    {d.additions === 0 && d.deletions === 0 && <span className="text-zinc-400">không đổi</span>}
                                </span>
                            </div>
                            <span className="text-[9px] text-zinc-400 font-semibold shrink-0">
                                {isExpanded ? 'Ẩn chi tiết [-]' : 'Xem thay đổi [+]'}
                            </span>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-zinc-200 p-2.5 bg-zinc-900 text-zinc-100 overflow-x-auto max-h-80 font-mono text-[11px] leading-relaxed">
                                {lines.map((line, lIdx) => {
                                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                                    const isDel = line.startsWith('-') && !line.startsWith('---');
                                    const isMeta = line.startsWith('@@');

                                    let bgClass = "pl-2 opacity-85";
                                    let prefix = "";
                                    let codeContent = line;

                                    if (isAdd) {
                                        bgClass = "bg-emerald-950/40 border-l-2 border-emerald-500 pl-1";
                                        prefix = "+ ";
                                        codeContent = line.substring(1);
                                    } else if (isDel) {
                                        bgClass = "bg-rose-950/40 border-l-2 border-rose-500 pl-1";
                                        prefix = "- ";
                                        codeContent = line.substring(1);
                                    } else if (isMeta) {
                                        bgClass = "bg-cyan-950/30 border-l-2 border-cyan-500 pl-1";
                                    }

                                    const highlightedHtml = highlightCodeLine(codeContent);

                                    return (
                                        <div key={lIdx} className={`whitespace-pre py-0.5 ${bgClass}`}>
                                            {prefix && (
                                                <span className={isAdd ? "text-emerald-500 font-bold mr-1 select-none" : "text-rose-500 font-bold mr-1 select-none"}>
                                                    {prefix}
                                                </span>
                                            )}
                                            {isAdd || isDel || (!line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('@@')) ? (
                                                <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                                            ) : (
                                                <span className={isMeta ? "text-cyan-400 font-semibold" : "text-zinc-500 italic"}>
                                                    {line}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
});