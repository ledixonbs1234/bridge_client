// filepath: ridge_client/src/components/SkillTester.tsx
import * as React from "react";
import { useState } from "react";
import { Button } from "./animate-ui/button";
import { ChatMessage, PermissionRequest } from "../hooks/useSSE";

interface SkillTesterProps {
    sse: {
        messages: ChatMessage[];
        setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
        setPendingPermission: React.Dispatch<React.SetStateAction<PermissionRequest | null>>;
        loadActiveSession?: () => Promise<void>; // Hàm đồng bộ hóa hội thoại thực tế từ Server
    };
    setReloadTrigger: React.Dispatch<React.SetStateAction<number>>; // Hàm cập nhật/vẽ lại sơ đồ
    theme?: "light" | "dark";
}

export function SkillTester({ sse, setReloadTrigger, theme = "light" }: SkillTesterProps) {
    const { loadActiveSession, setPendingPermission } = sse;
    const isDark = theme === "dark";

    const [rawInputText, setRawInputText] = useState<string>(`{
  "type": "tool_call",
  "name": "replace_content_safe",
  "arguments": {
    "file_path": "src/popup/popup.tsx",
    "task_description": "Thêm hàm removeVietnameseTones, cập nhật nameOptions hiển thị vị trí và sửa logic tìm kiếm không dấu",
    "replacements": [
      {
        "start_line": 45,
        "end_line": 52,
        "replacement_content": "  // Helper function to remove Vietnamese tones for search\\n  const removeVietnameseTones = (str: string) => {\\n    return str;\\n  };"
      }
    ]
  }
}`);

    const [isRunningSim, setIsRunningSim] = useState(false);
    const [simError, setSimError] = useState<string | null>(null);

    // Gửi log thô lên Backend để máy chủ bóc tách và ghi nhận vào Database thực tế
    const handleStartBackendProcessing = async () => {
        if (!rawInputText.trim() || isRunningSim) return;

        setIsRunningSim(true);
        setSimError(null);
        setPendingPermission(null);

        try {
            const res = await fetch("/api/dashboard/tester/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rawText: rawInputText })
            });

            // Nâng cấp: Kiểm tra kiểu dữ liệu trả về trước khi parse JSON để tránh lỗi "<!DOCTYPE"
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Mất kết nối tới Bridge Server. Hãy đảm bảo bạn đã khởi chạy server ở cổng 54321.");
            }

            const data = await res.json();
            if (data.success) {
                // 1. Tải lại lịch sử hội thoại thực tế từ Server
                if (loadActiveSession) {
                    await loadActiveSession();
                }
                // 2. Kích hoạt render lại sơ đồ với bối cảnh mới từ Server
                setReloadTrigger((prev) => prev + 1);

                alert("✓ Backend đã bóc tách, thực thi Tool, ghi nhận Database và đồng bộ sơ đồ thành công!");
            } else {
                setSimError(data.error || "Gặp sự cố khi Backend phân tích dữ liệu.");
            }
        } catch (err: any) {
            setSimError(`Lỗi kết nối tới máy chủ Backend: ${err.message}`);
        } finally {
            setIsRunningSim(false);
        }
    };

    return (
        <div className={`space-y-6 text-left transition-colors duration-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
            <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
                    <span>🧪</span> Live Raw Decoder (Bản phân tích cú pháp biểu thức thô)
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                    Hãy dán đoạn phản hồi dạng text thô của AI dưới đây (kèm các lệnh Gọi Tool, JSON thô, tham số...). Dữ liệu sẽ được gửi trực tiếp lên Backend để bóc tách, thực thi trực tiếp trên sandbox và đồng bộ tức thời lên sơ đồ Visual Flow.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className={`border p-5 rounded-xl space-y-4 transition-colors ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-xs"}`}>
                    <div className="flex justify-between items-center border-b pb-2 select-none">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Dữ liệu AI thô để gửi Backend (AI Raw Log Stream)
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono font-bold">Xử lý trực tiếp từ Server</span>
                    </div>

                    {simError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl font-mono text-xs text-red-600 text-left my-2">
                            <div className="font-bold text-red-600 mb-1">❌ Lỗi xử lý Backend:</div>
                            <div className="whitespace-pre-wrap select-text">{simError}</div>
                        </div>
                    )}

                    <textarea
                        value={rawInputText}
                        onChange={(e) => setRawInputText(e.target.value)}
                        disabled={isRunningSim}
                        rows={15}
                        className={`w-full p-4 border rounded-xl text-xs font-mono outline-none leading-relaxed transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-300 focus:border-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-800 focus:border-zinc-300"}`}
                    />

                    <div className="flex justify-end select-none">
                        <Button
                            onClick={handleStartBackendProcessing}
                            disabled={isRunningSim || !rawInputText.trim()}
                            className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold border-none text-xs cursor-pointer shadow-md"
                        >
                            {isRunningSim ? "⏳ Đang gửi và đồng bộ Backend..." : "▶ Bắt đầu bóc tách & Đồng bộ Backend"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}