// filepath: ridge_client/src/components/terminal/CollapsibleSteps.tsx
import * as React from "react";
import { useState, useEffect } from "react";
import { ExecutionStep } from "../../hooks/useSSE";
import { FileContentViewer } from "./FileContentViewer";

interface CollapsibleStepsProps {
    steps: ExecutionStep[];
    forceExpand?: boolean;
    onViewDiff?: (filePath: string) => void;
}

export const CollapsibleSteps = React.memo(function CollapsibleSteps({ steps, forceExpand = false, onViewDiff }: CollapsibleStepsProps) {
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (forceExpand) {
            setIsCollapsed(false);
        } else {
            setIsCollapsed(true);
        }
    }, [forceExpand]);

    if (!steps || steps.length === 0) return null;

    const thinkingCount = steps.filter(s => s.type === 'thinking').length;
    const fileCount = steps.filter(s => s.type === 'read_file').length;
    const commandCount = steps.filter(s => s.type === 'terminal' || s.type === 'search').length;

    const toggleStep = (stepId: string) => {
        setCollapsedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }));
    };

    return (
        <div className="my-2.5 text-left select-none max-w-full">
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-2 text-[10px] font-semibold text-zinc-500 hover:text-zinc-700 transition-colors cursor-pointer py-1 px-2.5 bg-zinc-50 border border-zinc-200 rounded-lg shadow-xs"
            >
                <span
                    className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-[7px] text-white transition-transform duration-200 select-none shrink-0 font-bold"
                    style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none' }}
                >
                    ▼
                </span>
                <span className="text-zinc-655">
                    Thought {thinkingCount}x, Read {fileCount}x, Run {commandCount}x
                </span>
            </button>

            {!isCollapsed && (
                <div className="mt-2 pl-3 border-l border-zinc-200 space-y-3 max-w-full">
                    {steps.map((step) => {
                        const isStepExpanded = !collapsedSteps[step.id];
                        const icon = step.type === 'thinking' ? '🧠' : step.type === 'read_file' ? '📄' : step.type === 'search' ? '🔍' : '💻';

                        return (
                            <div key={step.id} className="border border-zinc-200 rounded-lg bg-white overflow-hidden shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => toggleStep(step.id)}
                                    className="flex items-center justify-between w-full p-2 bg-zinc-50/50 hover:bg-zinc-100/60 text-left transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-1.5 overflow-hidden mr-2">
                                        <span className="text-xs shrink-0">{icon}</span>
                                        <span className="text-[11px] font-bold text-zinc-700 font-mono truncate">
                                            {step.title}
                                        </span>
                                    </div>
                                    <span className="text-[9px] text-zinc-400 font-semibold shrink-0">
                                        {isStepExpanded ? 'Thu gọn [-]' : 'Mở rộng [+]'}
                                    </span>
                                </button>

                                {isStepExpanded && (
                                    <div className="border-t border-zinc-200 p-3 bg-zinc-50/10 text-[11px] text-zinc-800 space-y-3 select-text font-mono">
                                        {step.type === 'thinking' && (
                                            <div className="space-y-1">
                                                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Thinking process</div>
                                                <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-655 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                                    {step.input}
                                                </pre>
                                            </div>
                                        )}

                                        {step.type === 'terminal' && (() => {
                                            let outputText = step.output || '';
                                            try {
                                                const parsed = typeof step.output === 'string' ? JSON.parse(step.output) : step.output;
                                                if (parsed && typeof parsed === 'object') {
                                                    if (parsed.status === 'success' && parsed.data) {
                                                        if (parsed.data.stdout !== undefined || parsed.data.stderr !== undefined) {
                                                            outputText = (parsed.data.stdout || '') + (parsed.data.stderr || '');
                                                        } else if (typeof parsed.data === 'string') {
                                                            outputText = parsed.data;
                                                        } else {
                                                            outputText = JSON.stringify(parsed.data, null, 2);
                                                        }
                                                    } else if (parsed.status === 'error') {
                                                        outputText = parsed.error_message || parsed.rawText || JSON.stringify(parsed, null, 2);
                                                    }
                                                }
                                            } catch { }

                                            return (
                                                <div className="space-y-1">
                                                    <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Terminal Console</div>
                                                    <div
                                                        style={{ backgroundColor: '#ffffff', borderColor: '#e4e4e7' }}
                                                        className="p-3 border rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap shadow-xs"
                                                    >
                                                        <div className="flex items-start gap-1.5 mb-2 pb-1.5 border-b border-zinc-100">
                                                            <span className="text-emerald-600 font-bold select-none shrink-0" style={{ color: '#059669' }}>$</span>
                                                            <span className="font-semibold break-all" style={{ color: '#2563eb' }}>
                                                                {step.input}
                                                            </span>
                                                        </div>

                                                        {outputText ? (
                                                            <div className="text-zinc-800 max-h-60 overflow-y-auto whitespace-pre-wrap leading-normal" style={{ color: '#27272a' }}>
                                                                {outputText}
                                                            </div>
                                                        ) : (
                                                            <div className="text-zinc-400 italic select-none" style={{ color: '#a1a1aa' }}>
                                                                Command executed / awaiting response...
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {step.type === 'read_file' && (() => {
                                            let isDir = false;
                                            let dirPath = '';
                                            let filesList: Array<{ name: string, type: string, path: string }> = [];
                                            let fileContent = '';
                                            let fileMeta: { file?: string; totalLines?: number } | null = null;
                                            let rawText = step.output || '';

                                            try {
                                                const parsed = typeof step.output === 'string' ? JSON.parse(step.output) : step.output;
                                                if (parsed && typeof parsed === 'object') {
                                                    const targetData = parsed.status === 'success' && parsed.data ? parsed.data : parsed;
                                                    if (targetData && typeof targetData === 'object') {
                                                        if (Array.isArray(targetData.files)) {
                                                            isDir = true;
                                                            dirPath = targetData.path || '';
                                                            filesList = targetData.files;
                                                        } else if (targetData.content !== undefined) {
                                                            fileContent = targetData.content;
                                                            fileMeta = {
                                                                file: targetData.file || targetData.file_path || '',
                                                                totalLines: targetData.total_lines || null,
                                                            };
                                                        } else if (typeof targetData === 'string') {
                                                            fileContent = targetData;
                                                        } else {
                                                            rawText = JSON.stringify(parsed, null, 2);
                                                        }
                                                    }
                                                }
                                            } catch { }

                                            let displayContent = fileContent;
                                            if (!isDir && !displayContent && rawText) {
                                                const trimmed = rawText.trim();
                                                const isJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
                                                if (!isJson) {
                                                    displayContent = rawText;
                                                }
                                            }

                                            return (
                                                <div className="space-y-1">
                                                    <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                                                        {isDir ? 'Danh sách thư mục' : 'Nội dung tập tin'}
                                                    </div>

                                                    {isDir ? (
                                                        <div className="p-3 bg-white border border-zinc-200 rounded-lg max-h-72 overflow-y-auto space-y-1.5 shadow-xs text-left">
                                                            {dirPath && (
                                                                <div className="text-[10px] text-zinc-450 font-mono border-b border-zinc-100 pb-1 mb-1.5 truncate">
                                                                    📂 {dirPath}
                                                                </div>
                                                            )}
                                                            <div className="divide-y divide-zinc-100 text-[11px] font-mono">
                                                                {filesList.map((file, fIdx) => (
                                                                    <div key={fIdx} className="flex items-center gap-1.5 py-1 hover:bg-zinc-50/70 px-1 rounded transition-colors">
                                                                        <span className="text-xs shrink-0 select-none">
                                                                            {file.type === 'directory' ? '📁' : '📄'}
                                                                        </span>
                                                                        <span className={file.type === 'directory' ? 'text-blue-600 font-semibold' : 'text-zinc-700'}>
                                                                            {file.name}
                                                                        </span>
                                                                        <span className="text-[8px] text-zinc-400 truncate ml-auto hidden md:inline">
                                                                            {file.path}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                                {filesList.length === 0 && (
                                                                    <div className="text-zinc-400 italic text-center py-3 select-none">Thư mục trống</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <FileContentViewer
                                                            content={displayContent || rawText}
                                                            filePath={fileMeta?.file || step.title.replace('📄 Read File: ', '').replace('📄 Read File ', '')}
                                                            totalLines={fileMeta?.totalLines}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {step.type === 'search' && (
                                            <div className="space-y-2.5">
                                                <div className="space-y-1">
                                                    <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Search Input</div>
                                                    <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-650 whitespace-pre-wrap">
                                                        {step.input}
                                                    </pre>
                                                </div>
                                                {step.output && (
                                                    <div className="space-y-1">
                                                        <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Search Result</div>
                                                        <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                                                            {step.output}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {step.type === 'generic' && (
                                            <div className="space-y-2.5">
                                                {step.input && (
                                                    <div className="space-y-1">
                                                        <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">File Path / Input</div>
                                                        <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-655 whitespace-pre-wrap">
                                                            {step.input}
                                                        </pre>
                                                    </div>
                                                )}

                                                {(() => {
                                                    let diffData: Array<{ file: string, additions: number, deletions: number }> = [];
                                                    try {
                                                        if (step.output) {
                                                            const parsed = JSON.parse(step.output);
                                                            const data = parsed.status === 'success' && parsed.data ? parsed.data : parsed;
                                                            if (data) {
                                                                if (Array.isArray(data.incremental_diffs)) {
                                                                    diffData = data.incremental_diffs;
                                                                } else if (data.incremental_diff) {
                                                                    diffData = [data.incremental_diff];
                                                                }
                                                            }
                                                        }
                                                    } catch { }

                                                    if (diffData.length > 0) {
                                                        return (
                                                            <div className="mt-2 space-y-1.5 text-left">
                                                                <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Tệp tin thay đổi trong bước này</div>
                                                                <div className="flex flex-col gap-1.5">
                                                                    {diffData.map((d, dIdx) => (
                                                                        <button
                                                                            key={dIdx}
                                                                            type="button"
                                                                            onClick={() => onViewDiff && onViewDiff(d.file)}
                                                                            className="flex items-center justify-between px-3 py-2 bg-zinc-50 border border-zinc-200 hover:border-blue-300 hover:bg-blue-50/20 rounded-lg text-xs font-mono transition-[border-color,background-color] duration-200 cursor-pointer w-full text-left shadow-xs"
                                                                        >
                                                                            <span className="text-zinc-700 font-bold truncate">📄 {d.file.split('/').pop()}</span>
                                                                            <span className="flex items-center gap-2">
                                                                                <span className="text-[10px] text-zinc-400 font-mono">
                                                                                    {d.additions > 0 && <span className="text-emerald-600 font-bold">+{d.additions}</span>}
                                                                                    {' '}
                                                                                    {d.deletions > 0 && <span className="text-rose-600 font-bold">-{d.deletions}</span>}
                                                                                </span>
                                                                                <span className="text-[10px] text-blue-600 font-bold hover:underline select-none">Xem chi tiết 🔍</span>
                                                                            </span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                {step.output && (
                                                    <div className="space-y-1">
                                                        <div className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Result</div>
                                                        {(() => {
                                                            let imageBase64 = null;
                                                            let cleanOutput = step.output;
                                                            try {
                                                                const parsed = JSON.parse(step.output);
                                                                const targetData = parsed.status === 'success' && parsed.data ? parsed.data : parsed;
                                                                if (targetData && typeof targetData === 'object') {
                                                                    if (targetData.image_base64) {
                                                                        imageBase64 = targetData.image_base64;
                                                                    } else if (targetData.data && targetData.data.image_base64) {
                                                                        imageBase64 = targetData.data.image_base64;
                                                                    }
                                                                }
                                                                if (imageBase64) {
                                                                    const cleanObj = JSON.parse(step.output);
                                                                    if (cleanObj.data && cleanObj.data.image_base64) {
                                                                        cleanObj.data.image_base64 = "[Base64 Image Data - Hidden for Performance]";
                                                                    } else if (cleanObj.image_base64) {
                                                                        cleanObj.image_base64 = "[Base64 Image Data - Hidden for Performance]";
                                                                    } else if (cleanObj.status === 'success' && cleanObj.data && typeof cleanObj.data === 'object') {
                                                                        if (cleanObj.data.image_base64) {
                                                                            cleanObj.data.image_base64 = "[Base64 Image Data - Hidden for Performance]";
                                                                        }
                                                                    }
                                                                    cleanOutput = JSON.stringify(cleanObj, null, 2);
                                                                }
                                                            } catch { }

                                                            if (imageBase64) {
                                                                return (
                                                                    <div className="space-y-2 text-left">
                                                                        <div className="relative inline-block max-w-full">
                                                                            <img
                                                                                src={imageBase64}
                                                                                alt="Captured Screen Preview"
                                                                                className="max-h-64 rounded-lg border border-zinc-200 shadow-md object-contain bg-zinc-50 p-1 cursor-zoom-in hover:opacity-95 transition-opacity"
                                                                                onClick={() => {
                                                                                    const w = window.open();
                                                                                    if (w) {
                                                                                        w.document.write(`<img src="${imageBase64}" style="max-width:100%; height:auto;" />`);
                                                                                        w.document.close();
                                                                                    }
                                                                                }}
                                                                                title="Nhấn để xem kích thước đầy đủ"
                                                                            />
                                                                        </div>
                                                                        <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                                                                            {cleanOutput}
                                                                        </pre>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <pre className="p-2.5 bg-white border border-zinc-200 rounded-md text-[11px] text-zinc-700 whitespace-pre-wrap leading-relaxed">
                                                                    {step.output}
                                                                </pre>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
});