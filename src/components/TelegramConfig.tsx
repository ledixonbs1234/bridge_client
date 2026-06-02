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
                    fetchConfig();
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
        return <div className="text-zinc-500 text-sm text-left">Đang tải cấu hình Telegram Bot...</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left text-zinc-800">
            {/* LEFT COLUMN: SETTING FORM */}
            <form onSubmit={handleSave} className="lg:col-span-7 bg-zinc-50 border border-zinc-200 p-6 rounded-xl space-y-6 shadow-xs">
                <div>
                    <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>✈️</span> Thiết lập Telegram Bot Notifications
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">Tự động nhận thông báo trạng thái hoặc phản hồi cấp quyền trực tiếp qua Telegram.</p>
                </div>

                {/* ENABLE TOGGLE SWITCH */}
                <div className="flex items-center justify-between p-3.5 bg-white border border-zinc-200 rounded-lg select-none">
                    <div>
                        <label className="text-xs font-semibold text-zinc-800 block">Kích hoạt thông báo</label>
                        <span className="text-[10px] text-zinc-500 font-medium">Bật/tắt toàn bộ tiến trình gửi tin nhắn qua Bot Telegram.</span>
                    </div>
                    <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
                    />
                </div>

                {/* MAIN FIELD INPUTS */}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-600">Telegram Bot Token</label>
                        <input
                            type="text"
                            value={config.botToken}
                            onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                            placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-300 focus:ring-1 focus:ring-zinc-200/50 outline-none font-mono shadow-xs"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-600">Chat ID (Nhóm hoặc Cá nhân)</label>
                        <input
                            type="text"
                            value={config.chatId}
                            onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                            placeholder="-100123456789 (Nhóm) hoặc 987654321 (Cá nhân)"
                            className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-800 placeholder-zinc-400 focus:border-zinc-300 focus:ring-1 focus:ring-zinc-200/50 outline-none font-mono shadow-xs"
                        />
                    </div>
                </div>

                {/* NOTIFICATION EVENT CONFIG */}
                <div className="space-y-3.5 border-t border-zinc-200 pt-4">
                    <h3 className="text-xs font-bold text-zinc-500">Các sự kiện cần gửi thông báo:</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-zinc-200 rounded-lg">
                            <input
                                id="tg_evt_perm"
                                type="checkbox"
                                checked={config.notifyOnPermission}
                                onChange={(e) => setConfig({ ...config, notifyOnPermission: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
                            />
                            <label htmlFor="tg_evt_perm" className="text-xs text-zinc-700 cursor-pointer select-none">
                                <b className="text-zinc-800 font-semibold">Yêu cầu phê duyệt (Permission)</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Thông báo khi Agent cần bạn phê duyệt lệnh hoặc sửa file.</span>
                            </label>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-zinc-200 rounded-lg">
                            <input
                                id="tg_evt_start"
                                type="checkbox"
                                checked={config.notifyOnPipelineStart}
                                onChange={(e) => setConfig({ ...config, notifyOnPipelineStart: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
                            />
                            <label htmlFor="tg_evt_start" className="text-xs text-zinc-700 cursor-pointer select-none">
                                <b className="text-zinc-800 font-semibold">Bắt đầu Pipeline</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Nhận tin nhắn cảnh báo khi một Pipeline mới bắt đầu chạy.</span>
                            </label>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-zinc-200 rounded-lg">
                            <input
                                id="tg_evt_success"
                                type="checkbox"
                                checked={config.notifyOnPipelineSuccess}
                                onChange={(e) => setConfig({ ...config, notifyOnPipelineSuccess: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
                            />
                            <label htmlFor="tg_evt_success" className="text-xs text-zinc-700 cursor-pointer select-none">
                                <b className="text-zinc-800 font-semibold">Pipeline thành công (Success)</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Cập nhật tin tức tự động khi các giai đoạn hoàn thành xuất sắc.</span>
                            </label>
                        </div>

                        <div className="flex items-start gap-2.5 p-2.5 bg-white border border-zinc-200 rounded-lg">
                            <input
                                id="tg_evt_fail"
                                type="checkbox"
                                checked={config.notifyOnPipelineFailure}
                                onChange={(e) => setConfig({ ...config, notifyOnPipelineFailure: e.target.checked })}
                                className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
                            />
                            <label htmlFor="tg_evt_fail" className="text-xs text-zinc-700 cursor-pointer select-none">
                                <b className="text-zinc-800 font-semibold">Pipeline thất bại (Failure)</b>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Nhận tin khẩn cấp khi hệ thống dừng hoặc step gặp lỗi.</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* ACTION FEEDBACK ALERT */}
                {message && (
                    <div
                        className={`p-3 rounded-lg text-xs font-mono font-medium ${message.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-red-55 border border-red-200 text-red-700"
                            }`}
                    >
                        {message.type === "success" ? "✓ " : "✗ "} {message.text}
                    </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="flex justify-between items-center border-t border-zinc-200/60 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestNotification}
                        disabled={testing || saving || !config.enabled}
                        className="text-xs font-semibold text-zinc-600 border-zinc-200 hover:bg-zinc-100 cursor-pointer h-9"
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

            {/* RIGHT COLUMN: MANUAL STEPPER */}
            <div className="lg:col-span-5 space-y-6">
                <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-xl space-y-4 shadow-xs">
                    <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center gap-2">
                        <span>📖</span> Hướng dẫn tạo & liên kết Telegram Bot
                    </h3>

                    <ol className="list-none pl-0 text-xs text-zinc-500 space-y-4">
                        <li className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
                            <div>
                                <b className="text-zinc-800 font-semibold">Tạo Bot Telegram mới:</b>
                                <p className="mt-1 leading-relaxed">Tìm kiếm tài khoản chính thức <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-mono hover:text-blue-500">@BotFather</a> trên ứng dụng Telegram. Gửi lệnh <code className="text-red-600 font-mono bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">/newbot</code> và làm theo các chỉ thị để nhận <b className="text-zinc-700">HTTP API Token</b>.</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
                            <div>
                                <b className="text-zinc-800 font-semibold">Kích hoạt hội thoại:</b>
                                <p className="mt-1 leading-relaxed">Nhấp vào liên kết bot của bạn vừa được tạo và nhấn nút <b className="text-zinc-700">START</b> để mở luồng giao tiếp ban đầu.</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
                            <div>
                                <b className="text-zinc-800 font-semibold">Trích xuất Chat ID:</b>
                                <p className="mt-1 leading-relaxed">Dò tìm tài khoản bot <a href="https://t.me/GetChatID_Bot" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-mono hover:text-blue-500">@GetChatID_Bot</a> hoặc gửi một tin nhắn bất kỳ tới <a href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-mono hover:text-blue-500">@userinfobot</a> để lấy mã ID cá nhân của bạn (chuỗi số nguyên dương).</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</span>
                            <div>
                                <b className="text-zinc-800 font-semibold">Liên kết nhóm (Tùy chọn):</b>
                                <p className="mt-1 leading-relaxed">Nếu muốn nhận tin trong nhóm chung, hãy thêm bot của bạn vào nhóm đó với quyền quản trị viên, sau đó lấy Chat ID của nhóm (chuỗi số bắt đầu bằng dấu trừ, ví dụ: <code className="text-zinc-700 font-mono bg-zinc-100 px-1 py-0.5 rounded border border-zinc-200">-100...</code>).</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">5</span>
                            <div>
                                <b className="text-zinc-800 font-semibold">Đồng bộ & Kiểm tra:</b>
                                <p className="mt-1 leading-relaxed">Dán Token và Chat ID vào khung thiết lập bên trái, nhấn <b className="text-zinc-700">Lưu cấu hình</b> và thử nghiệm gửi để xác nhận liên kết hoạt động tốt.</p>
                            </div>
                        </li>
                    </ol>
                </div>
            </div>
        </div>
    );
}