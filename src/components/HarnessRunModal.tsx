// filepath: bridge_client/src/components/HarnessRunModal.tsx
import * as React from "react";
import { useState } from "react";

interface HarnessRunModalProps {
    harnessId: string;
    harnessName: string;
    triggering: boolean;
    onSubmit: (harnessId: string, prompt: string) => void;
    onClose: () => void;
}

export function HarnessRunModal({ harnessId, harnessName, triggering, onSubmit, onClose }: HarnessRunModalProps) {
    const [promptText, setPromptText] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!promptText.trim()) return;
        onSubmit(harnessId, promptText);
    };

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs select-text text-left">
            <form
                onSubmit={handleSubmit}
                className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4 shadow-2xl max-w-md w-full relative"
                style={{ animation: 'zoomIn 0.18s ease-out' }}
            >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px] font-mono select-none">
                    <span>🚀</span> KHỞI CHẠY QUY TRÌNH TỰ ĐỘNG (FSM PIPELINE)
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-800">
                        Nhập yêu cầu nhiệm vụ cụ thể dành cho quy trình "{harnessName}":
                    </label>
                    <p className="text-[10px] text-zinc-400 font-medium">Sơ đồ sẽ tự động chạy Live dựa trên yêu cầu này của bạn.</p>
                    <textarea
                        required
                        value={promptText}
                        onChange={(e) => setPromptText(e.target.value)}
                        placeholder="Ví dụ: Hãy phân tích file server.js, thêm cổng bảo mật JWT auth và chạy test thử."
                        rows={3}
                        className="w-full mt-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs resize-none leading-relaxed"
                    />
                </div>

                <div className="flex gap-1.5 justify-end pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={triggering}
                        className="px-3.5 py-1.5 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer"
                    >
                        HỦY BỎ
                    </button>
                    <button
                        type="submit"
                        disabled={triggering || !promptText.trim()}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border-none shadow-sm"
                    >
                        {triggering ? "ĐANG KHỞI CHẠY..." : "XÁC NHẬN & CHẠY ▶"}
                    </button>
                </div>
            </form>
        </div>
    );
}