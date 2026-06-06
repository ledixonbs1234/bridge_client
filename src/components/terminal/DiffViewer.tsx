// filepath: ridge_client/src/components/terminal/DiffViewer.tsx
import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { highlightCodeLine } from "../../lib/utils";

interface DiffViewerProps {
    filePath: string;
}

const cleanPath = (p: string) => p.replace(/\\/g, '/').toLowerCase();
const pathBasename = (p: string) => p.split('/').pop() || '';

export const DiffViewer = React.memo(function DiffViewer({ filePath }: DiffViewerProps) {
    const [diffText, setDiffText] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDiff = useCallback(() => {
        setLoading(true);
        fetch('/api/dashboard/code-changes')
            .then((res) => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then((data) => {
                if (data.success && Array.isArray(data.changes)) {
                    const matched = data.changes.find((c: any) => {
                        const cFile = cleanPath(c.file);
                        const fFile = cleanPath(filePath);
                        return cFile.endsWith(fFile) || fFile.endsWith(cFile) || pathBasename(cFile) === pathBasename(fFile);
                    });

                    if (matched && matched.diff) {
                        setDiffText(matched.diff);
                    } else {
                        setDiffText(null);
                    }
                }
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, [filePath]);

    useEffect(() => {
        fetchDiff();
    }, [fetchDiff]);

    const lines = useMemo(() => {
        return diffText ? diffText.split('\n') : [];
    }, [diffText]);

    if (loading) {
        return (
            <div className="text-zinc-400 text-[10px] italic py-1 select-none text-left">
                ⌛ Đang so sánh thay đổi với Git Worktree...
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 text-[10px] py-1 select-none text-left">
                ❌ Không thể tải Git Diff: {error}
            </div>
        );
    }

    if (!diffText) {
        return (
            <div className="text-zinc-500 text-[10px] italic bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 select-none text-left">
                ℹ️ Không có thay đổi so với phiên bản gốc (Git Worktree sạch).
            </div>
        );
    }

    return (
        <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs my-1 select-text">
            <div className="bg-zinc-50 border-b border-zinc-200 px-3 py-1.5 flex items-center justify-between select-none">
                <span className="text-[10px] font-bold text-zinc-700 flex items-center gap-1.5">
                    <span>📊</span> Git Sandbox Diff
                </span>
                <button
                    type="button"
                    onClick={fetchDiff}
                    className="text-[9px] text-blue-600 hover:text-blue-500 font-semibold cursor-pointer"
                >
                    Nạp lại 🔄
                </button>
            </div>
            <div className="p-2.5 bg-zinc-900 text-zinc-100 overflow-x-auto max-h-80 font-mono text-[11px] leading-relaxed border-t border-zinc-800 text-left">
                {lines.map((line, idx) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    const isMeta = line.startsWith('@@');

                    let bgClass = "";
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
                        <div key={idx} className={`whitespace-pre py-0.5 ${bgClass}`}>
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
        </div>
    );
});