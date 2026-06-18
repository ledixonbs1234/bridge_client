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
    "file_path": "H:/DATA/JAVASCRIPT/EXTENSION/CCCD_HANHCHINHCONG/src/popup/popup.tsx",
    "task_description": "Thêm hàm removeVietnameseTones, cập nhật nameOptions hiển thị vị trí và sửa logic tìm kiếm không dấu",
    "replacements": [
      {
        "start_line": 45,
        "end_line": 52,
        "replacement_content": "  // Helper function to remove Vietnamese tones for search\\n  const removeVietnameseTones = (str: string) => {\\n    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, \\"a\\\");\\n    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, \\"e\\\");\\n    str = str.replace(/ì|í|ị|ỉ|ĩ/g, \\"i\\\");\\n    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, \\"o\\\");\\n    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, \\"u\\\");\\n    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, \\"y\\\");\\n    str = str.replace(/đ/g, \\"d\\\");\\n    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, \\"A\\\");\\n    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, \\"E\\\");\\n    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, \\"I\\\");\\n    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, \\"O\\\");\\n    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, \\"U\\\");\\n    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, \\"Y\\\");\\n    str = str.replace(/Đ/g, \\"D\\\");\\n    str = str.replace(/\\\\u0300|\\\\u0301|\\\\u0303|\\\\u0309|\\\\u0323/g, \\"\\\");\\n    str = str.replace(/\\\\u02C6|\\\\u0306|\\\\u031B/g, \\"\\\");\\n    return str;\\n  };\\n\\n  // State cho tìm vị trí theo tên\\n  const [searchName, setSearchName] = useState(\\\"\\\");\\n  const [searchResult, setSearchResult] = useState<null | { index: number, cccd: any }>(null);\\n  \\n  // Gợi ý tên từ queueData, bao gồm cả vị trí\\n  const queueListForSearch = Object.values(queueData || {});\\n  const nameOptions = queueListForSearch\\n    .map((item: any, idx: number) => ({\\n      value: item.Name,\\n      label: \`\${item.Name} (Vị trí: \${idx + 1})\`,\\n      index: idx + 1,\\n      cccd: item\\n    }))\\n    .filter((item, i, arr) => item.value && arr.findIndex(t => t.value === item.value) === i);"
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

            const data = await res.json();
            if (data.success) {
                // 1. Tải lại lịch sử hội thoại thực tế từ Server
                if (loadActiveSession) {
                    await loadActiveSession();
                }
                // 2. Kích hoạt render lại sơ đồ với bối cảnh mới từ Server
                setReloadTrigger((prev) => prev + 1);

                alert("✓ Backend đã bóc tách, ghi nhận Database và đồng bộ sơ đồ thành công!");
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
                    Hãy dán đoạn phản hồi dạng text thô của AI dưới đây (kèm các lệnh Gọi Tool, JSON thô, tham số...). Dữ liệu sẽ được gửi trực tiếp lên Backend để bóc tách, lưu vết vĩnh viễn và đồng bộ lên sơ đồ Visual Flow.
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
                        className={`w-full p-4 border rounded-xl text-xs font-mono outline-none leading-relaxed transition-colors ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-300 focus:border-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-850 focus:border-zinc-300"}`}
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