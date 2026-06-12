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

interface TelegramConfigProps {
    theme?: "light" | "dark";
}

export function TelegramConfig({ theme = "light" }: TelegramConfigProps) {
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

    const isDark = theme === "dark";

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
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 text-left transition-colors duration-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>

            {/* LEFT COLUMN: SETTING FORM */}
            <form onSubmit={handleSave} className={`lg:col-span-7 border p-6 rounded-xl space-y-6 shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                }`}>
                <div>
                    <h2 className={`text-sm font-bold uppercase tracking-wider mb-1 flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                        <span>✈️</span> Thiết lập Telegram Bot Notifications
                    </h2>
                    <p className="text-xs text-zinc-500 font-medium">Tự động nhận thông báo trạng thái hoặc phản hồi cấp quyền trực tiếp qua Telegram.</p>
                </div>

                {/* ENABLE TOGGLE SWITCH */}
                <div className={`flex items-center justify-between p-3.5 border rounded-lg select-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
                    }`}>
                    <div>
                        <label className={`text-xs font-semibold block ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Kích hoạt thông báo</label>
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
                        <label className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-650"}`}>Telegram Bot Token</label>
                        <input
                            type="text"
                            value={config.botToken}
                            onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                            placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-mono shadow-xs outline-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                }`}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className={`text-xs font-semibold ${isDark ? "text-zinc-400" : "text-zinc-655"}`}>Chat ID (Nhóm hoặc Cá nhân)</label>
                        <input
                            type="text"
                            value={config.chatId}
                            onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                            placeholder="-100123456789 (Nhóm) hoặc 987654321 (Cá nhân)"
                            className={`w-full px-3 py-2 border rounded-lg text-xs font-mono shadow-xs outline-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-zinc-700" : "bg-white border-zinc-200 text-zinc-800 focus:border-zinc-300"
                                }`}
                        />
                    </div>
                </div>

                {/* NOTIFICATION EVENT CONFIG */}
                <div className={`space-y-3.5 border-t pt-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                    <h3 className="text-xs font-bold text-zinc-500">Các sự kiện cần gửi thông báo:</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                            { id: "tg_evt_perm", key: "notifyOnPermission", title: "Yêu cầu phê duyệt (Permission)", desc: "Thông báo khi Agent cần bạn phê duyệt lệnh hoặc sửa file." },
                            { id: "tg_evt_start", key: "notifyOnPipelineStart", title: "Bắt đầu Pipeline", desc: "Nhận tin nhắn cảnh báo khi một Pipeline mới bắt đầu chạy." },
                            { id: "tg_evt_success", key: "notifyOnPipelineSuccess", title: "Pipeline thành công (Success)", desc: "Cập nhật tin tức tự động khi các giai đoạn hoàn thành xuất sắc." },
                            { id: "tg_evt_fail", key: "notifyOnPipelineFailure", title: "Pipeline thất bại (Failure)", desc: "Nhận tin khẩn cấp khi hệ thống dừng hoặc step gặp lỗi." }
                        ].map((evt) => (
                            <div key={evt.id} className={`flex items-start gap-2.5 p-2.5 border rounded-lg transition-colors ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
                                }`}>
                                <input
                                    id={evt.id}
                                    type="checkbox"
                                    checked={(config as any)[evt.key]}
                                    onChange={(e) => setConfig({ ...config, [evt.key]: e.target.checked })}
                                    className="mt-0.5 w-3.5 h-3.5 text-blue-600 bg-white border-zinc-300 rounded focus:ring-blue-500 focus:ring-offset-white cursor-pointer"
                                />
                                <label htmlFor={evt.id} className="text-xs text-zinc-400 cursor-pointer select-none">
                                    <b className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-850"}`}>{evt.title}</b>
                                    <span className="text-[10px] text-zinc-500 block mt-0.5">{evt.desc}</span>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

                {message && (
                    <div
                        className={`p-3 rounded-lg text-xs font-mono font-medium ${message.type === "success"
                            ? "bg-emerald-50/20 border border-emerald-500/30 text-emerald-500"
                            : "bg-red-50/20 border border-red-500/30 text-red-500"
                            }`}
                    >
                        {message.type === "success" ? "✓ " : "✗ "} {message.text}
                    </div>
                )}

                <div className={`flex justify-between items-center border-t pt-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestNotification}
                        disabled={testing || saving || !config.enabled}
                        className={`text-xs font-semibold h-9 transition-colors cursor-pointer ${isDark ? "border-zinc-800 text-zinc-300 hover:bg-zinc-800" : "border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                            }`}
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
                <div className={`border p-5 rounded-xl space-y-4 shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                    }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                        <span>📖</span> Hướng dẫn tạo & liên kết Telegram Bot
                    </h3>

                    <ol className="list-none pl-0 text-xs text-zinc-500 space-y-4">
                        {[
                            { step: 1, title: "Tạo Bot Telegram mới", desc: <>Tìm kiếm tài khoản chính thức <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline font-mono">@BotFather</a> trên ứng dụng Telegram. Gửi lệnh <code className={`font-mono px-1 py-0.5 rounded border ${isDark ? "bg-zinc-950 border-zinc-800 text-rose-400" : "bg-zinc-100 border-zinc-200 text-red-600"}`}>/newbot</code> và làm theo các chỉ thị để nhận HTTP API Token.</> },
                            { step: 2, title: "Kích hoạt hội thoại", desc: <>Nhấp vào liên kết bot của bạn vừa được tạo và nhấn nút <b className={isDark ? "text-zinc-200" : "text-zinc-700"}>START</b> để mở luồng giao tiếp ban đầu.</> },
                            { step: 3, title: "Trích xuất Chat ID", desc: <>Dò tìm tài khoản bot <a href="https://t.me/GetChatID_Bot" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline font-mono">@GetChatID_Bot</a> để lấy mã ID cá nhân của bạn (chuỗi số nguyên dương).</> },
                            { step: 4, title: "Liên kết nhóm (Tùy chọn)", desc: <>Nếu muốn nhận tin trong nhóm, hãy thêm bot vào nhóm đó với quyền quản trị viên, sau đó lấy Chat ID của nhóm (chuỗi số bắt đầu bằng dấu trừ, ví dụ: <code className={`font-mono px-1 py-0.5 rounded border ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"}`}>-100...</code>).</> },
                            { step: 5, title: "Đồng bộ & Kiểm tra", desc: <>Dán Token và Chat ID vào khung bên trái, nhấn <b className={isDark ? "text-zinc-200" : "text-zinc-700"}>Lưu cấu hình</b> và thử nghiệm gửi để xác nhận liên kết.</> }
                        ].map((item) => (
                            <li key={item.step} className="flex gap-3">
                                <span className="w-5 h-5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">{item.step}</span>
                                <div>
                                    <b className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{item.title}:</b>
                                    <p className="mt-1 leading-relaxed">{item.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </div>
    );
}