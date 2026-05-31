// ridge_client/src/components/TelegramConfig.tsx
import { useState, useEffect } from "react";
import { Button } from "./animate-ui/button";

interface TelegramConfigData {
    enabled: boolean;
    botToken: string;
    chatId: string;
    notifyOnPermission: boolean;
    notifyOnPipelineSuccess: boolean;
    notifyOnPipelineFailure: boolean;
    notifyOnPipelineStart: boolean;
}

export function TelegramConfig() {
    const [config, setConfig] = useState<TelegramConfigData>({
        enabled: false,
        botToken: "",
        chatId: "",
        notifyOnPermission: true,
        notifyOnPipelineSuccess: true,
        notifyOnPipelineFailure: true,
        notifyOnPipelineStart: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = () => {
        fetch("/api/dashboard/telegram")
            .then((res) => {
                if (!res.ok) throw new Error("Không thể tải cấu hình Telegram");
                return res.json();
            })
            .then((data) => {
                if (data.success && data.config) {
                    setConfig(data.config);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setMessage({ text: err.message, type: "error" });
                setLoading(false);
            });
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        fetch("/api/dashboard/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(config),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setMessage({ text: data.message || "Đã lưu cấu hình thành công!", type: "success" });
                    fetchConfig(); // Tải lại để hiển thị Token đã bị ẩn
                } else {
                    throw new Error(data.error || "Gặp lỗi khi lưu");
                }
            })
            .catch((err) => {
                setMessage({ text: err.message, type: "error" });
            })
            .finally(() => setSaving(false));
    };

    const handleTestNotification = () => {
        setTesting(true);
        setMessage(null);

        fetch("/api/dashboard/telegram/test", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setMessage({ text: data.message || "Đã phát một tin nhắn thử nghiệm!", type: "success" });
                } else {
                    throw new Error(data.error || "Gặp lỗi khi thử nghiệm");
                }
            })
            .catch((err) => {
                setMessage({ text: err.message, type: "error" });
            })
            .finally(() => setTesting(false));
    };

    if (loading) {
        return <div className="text-zinc-400 text-sm text-left">Đang tải cấu hình Telegram Bot...</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            {/* CỘT TRÁI: FORM CẤU HÌNH */}
            <form onSubmit={handleSave} className="lg:col-span-7 bg-zinc-900 border border-zinc-800 p-6 rounded-xl space-y-6 shadow-md">
                <div>
                    <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>✈️</span> Thiết lập Telegram Bot Notifications
                    </h2>
                    <p className="text-xs text-zinc-500">Tự động nhận thông báo trạng thái hoặc phản hồi cấp quyền trực tiếp qua Telegram.</p>
                </div>

                {/* TRẠNG THÁI KÍCH HOẠT */}
                <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-lg select-none">
                    <div>
                        <label className="text-xs font-semibold text-zinc-300 block">Kích hoạt thông báo</label>
                        <span className="text-[10px] text-zinc-500">Bật/tắt toàn bộ tiến trình gửi tin nhắn qua Bot Telegram.</span>
                    </div>
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                    />
                </div>

                {/* INPUTS CHÍNH */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Telegram Bot Token</label>
                        <input
                            type="text"
                            value={config.botToken}
                            onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                            placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 outline-none font-mono"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400">Chat ID (Nhóm hoặc Cá nhân)</label>
                        <input
                            type="text"
                            value={config.chatId}
                            onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                            placeholder="-100123456789 (Nhóm) hoặc 987654321 (Cá nhân)"
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 outline-none font-mono"
                        />
                    </div>
                </div>

                {/* DANH SÁCH SỰ KIỆN NHẬN THÔNG BÁO */}
                <div className="space-y-3.5 border-t border-zinc-850 pt-4">
                    <h3 className="text-xs font-bold text-zinc-400">Các sự kiện cần gửi thông báo:</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2.5 p-2 bg-zinc-950/20 border border-zinc-850/50 rounded-lg">
                            <input
                                id="tg_evt_perm"
                                type="checkbox"
                                checked={config.notifyOnPermission}
                                onChange={(e) => setConfig({ ...config, notifyOnPermission: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                            />
                            <label htmlFor="tg_evt_perm" className="text-xs text-zinc-300 cursor-pointer">
                                <b>Yêu cầu phê duyệt (Permission)</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Thông báo khi Agent cần bạn phê duyệt lệnh hoặc sửa file.</span>
                            </label>
                        </div>

                        <div className="flex items-start gap-2.5 p-2 bg-zinc-950/20 border border-zinc-850/50 rounded-lg">
                            <input
                                id="tg_evt_start"
                                type="checkbox"
                                checked={config.notifyOnPipelineStart}
                                onChange={(e) => setConfig({ ...config, notifyOnPipelineStart: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                            />
                            <label htmlFor="tg_evt_start" className="text-xs text-zinc-300 cursor-pointer">
                                <b>Bắt đầu Pipeline</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Nhận tin nhắn cảnh báo khi một Pipeline mới bắt đầu chạy.</span>
                            </label>
                        </div>

                        <div className="flex items-start gap-2.5 p-2 bg-zinc-950/20 border border-zinc-850/50 rounded-lg">
                            <input
                                id="tg_evt_success"
                                type="checkbox"
                                checked={config.notifyOnPipelineSuccess}
                                onChange={(e) => setConfig({ ...config, notifyOnPipelineSuccess: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                            />
                            <label htmlFor="tg_evt_success" className="text-xs text-zinc-300 cursor-pointer">
                                <b>Pipeline thành công (Success)</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Cập nhật tin tức tự động khi các giai đoạn hoàn thành xuất sắc.</span>
                            </label>
                        </div>

                        <div className="flex items-start gap-2.5 p-2 bg-zinc-950/20 border border-zinc-850/50 rounded-lg">
                            <input
                                id="tg_evt_fail"
                                type="checkbox"
                                checked={config.notifyOnPipelineFailure}
                                onChange={(e) => setConfig({ ...config, notifyOnPipelineFailure: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-zinc-800 border-zinc-700 rounded focus:ring-blue-500 focus:ring-offset-zinc-900 cursor-pointer"
                            />
                            <label htmlFor="tg_evt_fail" className="text-xs text-zinc-300 cursor-pointer">
                                <b>Pipeline thất bại (Failure)</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Nhận tin khẩn cấp khi hệ thống dừng hoặc step gặp lỗi.</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* FEEDBACK STATUS */}
                {message && (
                    <div
                        className={`p-3 rounded-lg text-xs font-mono font-medium ${message.type === "success"
                            ? "bg-emerald-950/30 border border-emerald-900/40 text-emerald-400"
                            : "bg-red-950/30 border border-red-900/40 text-red-400"
                            }`}
                    >
                        {message.type === "success" ? "✓ " : "✗ "} {message.text}
                    </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="flex justify-between items-center border-t border-zinc-850 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestNotification}
                        disabled={testing || saving || !config.enabled}
                        className="text-xs font-semibold text-zinc-300 cursor-pointer h-9"
                    >
                        {testing ? "Đang gửi..." : "🔔 Thử nghiệm gửi"}
                    </Button>

                    <Button
                        type="submit"
                        variant="default"
                        disabled={saving || testing}
                        className="text-xs font-semibold h-9"
                    >
                        {saving ? "Đang lưu..." : "Lưu cấu hình"}
                    </Button>
                </div>
            </form>

            {/* CỘT PHẢI: HƯỚNG DẪN CHI TIẾT */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-xl space-y-4">
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                        <span>📖</span> Hướng dẫn tạo & liên kết Telegram Bot
                    </h3>

                    <ol className="list-decimal pl-4 text-xs text-zinc-400 space-y-3.5">
                        <li>
                            <b className="text-zinc-200">Tạo Bot Telegram mới:</b>
                            <p className="mt-0.5">Mở Telegram, tìm kiếm tài khoản chính thức <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-mono">@BotFather</a>. Gửi lệnh <code className="text-red-400 font-mono">/newbot</code> và làm theo hướng dẫn để nhận <b className="text-zinc-300">HTTP API Token</b>.</p>
                        </li>
                        <li>
                            <b className="text-zinc-200">Kích hoạt cuộc hội thoại:</b>
                            <p className="mt-0.5">Nhấp vào link bot của bạn (ví dụ: <code className="text-zinc-300 font-mono">t.me/your_bot</code>) và nhấn nút <b className="text-zinc-300">START</b> để mở luồng giao tiếp.</p>
                        </li>
                        <li>
                            <b className="text-zinc-200">Trích xuất Chat ID của bạn:</b>
                            <p className="mt-0.5">Dò tìm tài khoản bot <a href="https://t.me/GetChatID_Bot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-mono">@GetChatID_Bot</a> hoặc gửi tin nhắn bất kỳ tới <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline font-mono">@userinfobot</a> để lấy ID cá nhân của bạn (Chuỗi số nguyên dương).</p>
                        </li>
                        <li>
                            <b className="text-zinc-200">Liên kết nhóm (Tùy chọn):</b>
                            <p className="mt-0.5">Nếu muốn nhận tin nhắn trong nhóm, hãy thêm bot của bạn vào nhóm đó với quyền quản trị viên, sau đó lấy Chat ID của nhóm (Thường bắt đầu bằng dấu trừ, ví dụ: <code className="text-zinc-300 font-mono">-100...</code>).</p>
                        </li>
                        <li>
                            <b className="text-zinc-200">Kích hoạt & Lưu:</b>
                            <p className="mt-0.5">Dán thông tin API Token và Chat ID vào các ô bên trái, tích chọn sự kiện, nhấn <b className="text-zinc-300">Lưu cấu hình</b> và nhấn nút <b className="text-zinc-300">Thử nghiệm gửi</b> để xác nhận.</p>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}