import { useEffect, useState } from "react";
import { Button } from "./animate-ui/button";

interface ShadowChange {
    file: string;
    absolute_path: string;
    status: "added" | "modified" | "deleted" | string;
    additions: number;
    deletions: number;
    diff: string;
}

interface SandboxManagerProps {
    reloadTrigger: number;
}

export function SandboxManager({ reloadTrigger }: SandboxManagerProps) {
    const [changes, setChanges] = useState<ShadowChange[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDiff, setSelectedDiff] = useState<ShadowChange | null>(null);

    useEffect(() => {
        loadShadowChanges();
    }, [reloadTrigger]);

    const loadShadowChanges = () => {
        setLoading(true);
        fetch("/api/dashboard/shadow-changes")
            .then((res) => {
                if (!res.ok) throw new Error("Không thể kết nối đến máy chủ");
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setChanges(data.changes || []);
                }
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    };

    if (loading && changes.length === 0) {
        return <div className="text-zinc-500 text-sm text-left">Đang tải danh sách Giao dịch tệp (Shadow Files)...</div>;
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-left font-mono">
                ❌ Lỗi nạp dữ liệu Shadow Files: {error}
            </div>
        );
    }

    return (
        <div className="space-y-6 text-left text-zinc-800 animate-fade-in">
            {/* System explanation card */}
            <div className="bg-zinc-50 border border-zinc-200 p-5 rounded-xl shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🛡️</span> Cơ chế bảo vệ tệp tin tự động (Shadow Transaction)
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed font-medium">
                    Hệ thống tự động chụp nhanh snapshot mã nguồn nguyên bản trước khi AI thực thi bất kỳ thao tác chỉnh sửa tệp tin nào. Nếu có lỗi cú pháp hoặc lỗi logic từ kết quả kiểm duyệt (Validator), hệ thống sẽ lập tức khôi phục (rollback) nguyên trạng tệp tin để bảo vệ dự án tối đa mà không phụ thuộc vào Git Worktree cồng kềnh.
                </p>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Giao dịch tệp nguồn đang hoạt động (Active Shadow Files)
                    </h3>
                    <button onClick={loadShadowChanges} className="text-xs text-blue-600 hover:underline cursor-pointer">
                        Làm mới dữ liệu
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-zinc-700">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                            <tr>
                                <th className="p-3 font-semibold text-left border-zinc-200">Tên tệp tin</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Trạng thái sửa đổi</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Thay đổi dòng</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Đường dẫn tệp tin thực tế (Absolute Path)</th>
                                <th className="p-3 font-semibold text-center border-zinc-200">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {changes.map((c, idx) => {
                                const isModified = c.status === "modified";
                                const isAdded = c.status === "added";
                                return (
                                    <tr key={idx} className="hover:bg-zinc-50/50">
                                        <td className="p-3 font-mono font-bold text-zinc-900 text-left border-zinc-200">
                                            {c.file.split('/').pop()}
                                        </td>
                                        <td className="p-3 text-left border-zinc-200">
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${isModified
                                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                    : isAdded
                                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                        : "bg-red-100 text-red-800 border border-red-200"
                                                    }`}
                                            >
                                                {c.status}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-left border-zinc-200">
                                            <span className="flex gap-2">
                                                {c.additions > 0 && <span className="text-emerald-600 font-bold">+{c.additions}</span>}
                                                {c.deletions > 0 && <span className="text-rose-600 font-bold">-{c.deletions}</span>}
                                                {c.additions === 0 && c.deletions === 0 && <span className="text-zinc-400">chưa thay đổi</span>}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-zinc-500 truncate max-w-xs text-left border-zinc-200" title={c.absolute_path}>
                                            {c.absolute_path}
                                        </td>
                                        <td className="p-3 text-center border-zinc-200">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => setSelectedDiff(c)}
                                                className="h-7 text-[10px] font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer animate-fade-in"
                                            >
                                                🔍 Xem chi tiết Diff
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {changes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-400 border-zinc-200 bg-white">
                                        Hiện tại không có tệp tin nào đang được cách ly sửa đổi bằng Shadow Files.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detailed Diff Panel */}
            {selectedDiff && (
                <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white shadow-xs animate-fade-in">
                    <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-3 flex justify-between items-center select-none">
                        <span className="text-xs font-bold text-zinc-700 flex items-center gap-1.5">
                            <span>📊</span> So sánh Diff tệp: <code className="text-blue-600">{selectedDiff.file}</code>
                        </span>
                        <button
                            type="button"
                            onClick={() => setSelectedDiff(null)}
                            className="text-xs text-zinc-500 hover:text-zinc-800 font-semibold cursor-pointer"
                        >
                            Ẩn Diff [x]
                        </button>
                    </div>
                    <div className="p-4 bg-zinc-900 text-zinc-100 overflow-x-auto max-h-96 font-mono text-xs leading-relaxed text-left border-t border-zinc-800">
                        {selectedDiff.diff ? (
                            <div className="divide-y divide-zinc-850/10">
                                {selectedDiff.diff.split('\n').map((line, idx) => {
                                    let colorClass = "text-zinc-300";
                                    let bgClass = "";

                                    if (line.startsWith('+') && !line.startsWith('+++')) {
                                        colorClass = "text-emerald-400";
                                        bgClass = "bg-emerald-950/30 border-l-2 border-emerald-500 pl-3";
                                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                                        colorClass = "text-rose-400";
                                        bgClass = "bg-rose-950/30 border-l-2 border-rose-500 pl-3";
                                    } else {
                                        bgClass = "pl-3 opacity-80";
                                    }

                                    return (
                                        <div key={idx} className={`whitespace-pre py-0.5 ${bgClass} ${colorClass}`}>
                                            {line}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-zinc-400 italic text-center py-6">Không có thay đổi nào trong tệp này.</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}