// filepath: ridge_client/src/components/terminal/FileContentViewer.tsx
import * as React from "react";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface FileContentViewerProps {
    content: string;
    filePath: string;
    totalLines?: number | null;
}

export function FileContentViewer({ content, filePath, totalLines }: FileContentViewerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!content) return;
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const fileName = filePath.split('/').pop() || filePath;
    const hasContent = !!content && content.trim().length > 0;

    // PHÂN TÍCH THÔNG MINH: Phát hiện nếu nội dung file là một tệp hình ảnh mã hóa dạng Base64
    let imageBase64: string | null = null;
    let cleanContent = content;

    try {
        const parsed = JSON.parse(content);
        const targetData = parsed.status === 'success' && parsed.data ? parsed.data : parsed;
        if (targetData && typeof targetData === 'object') {
            if (targetData.image_base64) {
                imageBase64 = targetData.image_base64;
            } else if (targetData.data && targetData.data.image_base64) {
                imageBase64 = targetData.data.image_base64;
            }
        }
        if (imageBase64) {
            const cleanObj = JSON.parse(content);
            if (cleanObj.data && cleanObj.data.image_base64) {
                cleanObj.data.image_base64 = "[Base64 Image Data - Hidden for Performance]";
            } else if (cleanObj.image_base64) {
                cleanObj.image_base64 = "[Base64 Image Data - Hidden for Performance]";
            } else if (cleanObj.status === 'success' && cleanObj.data && typeof cleanObj.data === 'object') {
                if (cleanObj.data.image_base64) {
                    cleanObj.data.image_base64 = "[Base64 Image Data - Hidden for Performance]";
                }
            }
            cleanContent = JSON.stringify(cleanObj, null, 2);
        }
    } catch { }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsModalOpen(false);
        };
        if (isModalOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isModalOpen]);

    return (
        <>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsModalOpen(true);
                }}
                className="group relative flex items-center gap-2 px-3 py-2 bg-white border-2 border-blue-400 hover:border-blue-600 hover:bg-blue-50/30 rounded-lg text-xs font-medium text-zinc-700 transition-all cursor-pointer w-full max-w-md shadow-lg active:scale-[0.98]"
                style={{ pointerEvents: 'auto', zIndex: 100 }}
            >
                <span className="text-[11px] font-mono font-semibold truncate text-zinc-800 flex-1 text-left" title={filePath}>
                    📄 {fileName}
                </span>
                {totalLines && (
                    <span className="ml-auto text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-mono group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                        {totalLines} dòng
                    </span>
                )}
            </button>

            {typeof document !== 'undefined' && isModalOpen && createPortal(
                <div
                    className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 select-text"
                    style={{ zIndex: 999999 }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsModalOpen(false);
                    }}
                >
                    <div
                        className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl h-[80vh] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                        style={{ animation: 'zoomIn 0.2s ease-out' }}
                    >
                        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center select-none shrink-0">
                            <div className="text-left max-w-[70%]">
                                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <span>📄</span> Nội dung tập tin
                                </h3>
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate" title={filePath}>
                                    {filePath}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    disabled={!hasContent || !!imageBase64}
                                    className={`px-3 py-1.5 border rounded-lg text-xs font-bold transition-colors ${hasContent && !imageBase64
                                        ? 'bg-white hover:bg-zinc-100 border-zinc-200 text-zinc-700 cursor-pointer'
                                        : 'bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed'
                                        }`}
                                >
                                    {copied ? 'Đã sao chép ✓' : 'Sao chép'}
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer transition-colors"
                                >
                                    Đóng [Esc]
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto p-6 bg-zinc-900 text-zinc-100 font-mono text-xs leading-relaxed text-left relative">
                            {hasContent ? (
                                imageBase64 ? (
                                    <div className="flex flex-col gap-4 items-center h-full">
                                        <div className="flex-1 flex items-center justify-center min-h-[300px] w-full bg-zinc-950/40 rounded-xl p-4 border border-zinc-800">
                                            <img
                                                src={imageBase64}
                                                alt="Decoded Local Asset"
                                                className="max-h-[50vh] max-w-full rounded-lg shadow-2xl object-contain border border-zinc-700"
                                            />
                                        </div>
                                        <pre className="w-full whitespace-pre-wrap break-words border-t border-zinc-800 pt-4 mt-2 text-zinc-500 text-[10px]">
                                            {cleanContent}
                                        </pre>
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap break-words">{content}</pre>
                                )
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 space-y-2">
                                    <span className="text-4xl opacity-50">📂</span>
                                    <p className="text-sm font-medium">Không tìm thấy nội dung file.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}