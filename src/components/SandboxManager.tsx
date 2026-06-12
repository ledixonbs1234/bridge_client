import { useEffect, useState } from "react";
import { Button } from "./animate-ui/button";
import { highlightCodeLine } from "../lib/utils";

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
    theme?: "light" | "dark";
}

export function SandboxManager({ reloadTrigger, theme = "light" }: SandboxManagerProps) {
    const [changes, setChanges] = useState<ShadowChange[]>([]);
    const [gitChanges, setGitChanges] = useState<ShadowChange[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedDiff, setSelectedDiff] = useState<ShadowChange | null>(null);

    const isDark = theme === "dark";

    useEffect(() => {
        loadShadowChanges();
        loadGitChanges();
    }, [reloadTrigger]);

    const loadShadowChanges = () => {
        setLoading(true);
        fetch("/api/dashboard/shadow-changes")
            .then((res) => res.json())
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

    const loadGitChanges = () => {
        fetch("/api/dashboard/code-changes")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setGitChanges(data.changes || []);
                }
            })
            .catch((err) => console.error("Error loading Git changes:", err));
    };

    const handleRollback = (file?: string) => {
        const confirmMsg = file
            ? `Bạn có chắc chắn muốn khôi phục tệp "${file.split('/').pop()}" về nguyên trạng ban đầu?`
            : "Bạn có chắc chắn muốn khôi phục TOÀN BỘ các tệp đang thay đổi về nguyên trạng ban đầu?";
        if (!confirm(confirmMsg)) return;

        fetch("/api/dashboard/shadow-changes/rollback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file })
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    alert(data.message);
                    loadShadowChanges();
                    loadGitChanges();
                    setSelectedDiff(null);
                } else {
                    alert("Lỗi khôi phục: " + data.error);
                }
            })
            .catch((err) => alert("Lỗi kết nối: " + err.message));
    };

    if (loading && changes.length === 0 && gitChanges.length === 0) {
        return <div className="text-zinc-500 text-sm text-left">Đang tải danh sách Giao dịch tệp...</div>;
    }

    return (
        <div className={`space-y-6 text-left transition-colors duration-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>

            {/* THẺ GIẢI THÍCH CHỈ SỐ */}
            <div className={`border p-5 rounded-xl shadow-xs flex justify-between items-center flex-wrap gap-4 transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                }`}>
                <div className="space-y-2 max-w-2xl">
                    <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-zinc-300" : "text-zinc-500"}`}>
                        <span>🛡️</span> Cơ chế bảo vệ tệp tin tự động (Shadow Transaction)
                    </h3>
                    <p className={`text-xs leading-relaxed font-semibold ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
                        Hệ thống tự động chụp nhanh snapshot mã nguồn nguyên bản trước khi AI thực thi bất kỳ thao tác chỉnh sửa tệp tin nào. Khi tác vụ hoàn tất thành công, các tệp tạm sẽ được commit và lưu trữ lâu dài vào <b>Git Workspace</b> dưới đây.
                    </p>
                </div>
                {changes.length > 0 && (
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRollback()}
                        className="h-9 px-4 text-xs font-semibold cursor-pointer shrink-0"
                    >
                        ↩️ Khôi phục toàn bộ ({changes.length} tệp)
                    </Button>
                )}
            </div>

            {/* BẢNG 1: GIAO DỊCH TẠM THỜI (SHADOW FILES) */}
            <div className={`border rounded-xl overflow-hidden shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                }`}>
                <div className={`p-4 border-b flex justify-between items-center transition-colors duration-200 ${isDark ? "bg-zinc-950/40 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
                    }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-350" : "text-zinc-500"}`}>
                        1. Giao dịch cách ly tạm thời (Active Shadow Files - Trong khi chạy)
                    </h3>
                    <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded font-bold">
                        Đang chờ duyệt
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-zinc-700">
                        <thead className={`border-b text-zinc-500 transition-colors ${isDark ? "bg-zinc-950/60 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                            }`}>
                            <tr>
                                <th className="p-3 font-semibold text-left border-zinc-200">Tên tệp tin</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Trạng thái</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Thay đổi dòng</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Đường dẫn thực tế</th>
                                <th className="p-3 font-semibold text-center border-zinc-200">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y transition-colors ${isDark ? "divide-zinc-800/60" : "divide-zinc-200"}`}>
                            {changes.map((c, idx) => (
                                <tr key={idx} className={isDark ? "hover:bg-zinc-850/40" : "hover:bg-zinc-50/50"}>
                                    <td className={`p-3 font-mono font-bold text-left border-zinc-200 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{c.file.split('/').pop()}</td>
                                    <td className="p-3 text-left border-zinc-200">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-left border-zinc-200">
                                        <span className="flex gap-2">
                                            {c.additions > 0 && <span className="text-emerald-600 font-bold">+{c.additions}</span>}
                                            {c.deletions > 0 && <span className="text-rose-600 font-bold">-{c.deletions}</span>}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-zinc-500 truncate max-w-xs text-left border-zinc-200" title={c.absolute_path}>{c.absolute_path}</td>
                                    <td className="p-3 text-center border-zinc-200 flex justify-center gap-1.5">
                                        <Button size="sm" variant="outline" onClick={() => setSelectedDiff(c)} className={`h-7 text-[10px] font-bold transition-colors cursor-pointer ${isDark ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "text-blue-600 border-blue-200 hover:bg-blue-50"
                                            }`}>🔍 Xem Diff</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleRollback(c.file)} className="h-7 text-[10px] font-bold text-red-655 border-red-200 hover:bg-red-50 cursor-pointer">↩️ Khôi phục</Button>
                                    </td>
                                </tr>
                            ))}
                            {changes.length === 0 && (
                                <tr>
                                    <td colSpan={5} className={`p-6 text-center text-zinc-400 border-zinc-200 italic ${isDark ? "bg-zinc-950/40" : "bg-white"}`}>
                                        Không có tệp nào đang cách ly (chỉ xuất hiện tạm thời khi AI đang sửa đổi).
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BẢNG 2: THAY ĐỔI THỰC TẾ TRÊN ĐĨA (GIT WORKSPACE) */}
            <div className={`border rounded-xl overflow-hidden shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                }`}>
                <div className={`p-4 border-b flex justify-between items-center transition-colors duration-200 ${isDark ? "bg-zinc-950/40 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
                    }`}>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-350" : "text-zinc-500"}`}>
                        2. Các tệp đã thay đổi thực tế trên đĩa cứng (Git Workspace Changes)
                    </h3>
                    <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded font-bold">
                        Đã ghi thành công
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-zinc-700">
                        <thead className={`border-b text-zinc-500 transition-colors ${isDark ? "bg-zinc-950/60 border-zinc-800" : "bg-zinc-50 border-zinc-200"
                            }`}>
                            <tr>
                                <th className="p-3 font-semibold text-left border-zinc-200">Tên tệp tin</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Trạng thái</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Thay đổi dòng</th>
                                <th className="p-3 font-semibold text-center border-zinc-200">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y transition-colors ${isDark ? "divide-zinc-800/60" : "divide-zinc-200"}`}>
                            {gitChanges.map((c, idx) => (
                                <tr key={idx} className={isDark ? "hover:bg-zinc-850/40" : "hover:bg-zinc-50/50"}>
                                    <td className={`p-3 font-mono font-bold text-left border-zinc-200 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{c.file.split('/').pop()}</td>
                                    <td className="p-3 text-left border-zinc-200">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.status === "added" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                                            {c.status}
                                        </span>
                                    </td>
                                    <td className="p-3 font-mono text-left border-zinc-200">
                                        <span className="flex gap-2">
                                            {c.additions > 0 && <span className="text-emerald-600 font-bold">+{c.additions}</span>}
                                            {c.deletions > 0 && <span className="text-rose-600 font-bold">-{c.deletions}</span>}
                                        </span>
                                    </td>
                                    <td className="p-3 text-center border-zinc-200">
                                        <Button size="sm" variant="outline" onClick={() => setSelectedDiff(c)} className={`h-7 text-[10px] font-bold transition-colors cursor-pointer ${isDark ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "text-blue-600 border-blue-200 hover:bg-blue-50"
                                            }`}>🔍 Xem Diff thực tế</Button>
                                    </td>
                                </tr>
                            ))}
                            {gitChanges.length === 0 && (
                                <tr>
                                    <td colSpan={4} className={`p-6 text-center text-zinc-400 border-zinc-200 italic ${isDark ? "bg-zinc-950/40" : "bg-white"}`}>
                                        Workspace hiện tại sạch sẽ (không có thay đổi chưa commit).
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TRÌNH DUYỆT SO SÁNH TỆP DIFF CÓ THỂ ĐỔI THEME */}
            {selectedDiff && (
                <div className={`border rounded-xl overflow-hidden shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                    }`}>
                    <div className={`px-4 py-3 flex justify-between items-center select-none transition-colors duration-200 ${isDark ? "bg-zinc-950/60 border-b border-zinc-800" : "bg-zinc-50 border-b border-zinc-200"
                        }`}>
                        <span className="text-xs font-bold flex items-center gap-1.5">
                            <span>📊</span> So sánh Diff tệp: <code className="text-blue-500">{selectedDiff.file}</code>
                        </span>
                        <button type="button" onClick={() => setSelectedDiff(null)} className="text-xs text-zinc-400 hover:text-zinc-600 font-semibold cursor-pointer border-none bg-transparent">Ẩn Diff [x]</button>
                    </div>
                    <div className="p-4 bg-zinc-900 text-zinc-100 overflow-x-auto max-h-96 font-mono text-xs leading-relaxed text-left border-t border-zinc-800">
                        {selectedDiff.diff ? (
                            <div className="divide-y divide-zinc-850/10">
                                {selectedDiff.diff.split('\n').map((line, idx) => {
                                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                                    const isDel = line.startsWith('-') && !line.startsWith('---');

                                    let bgClass = "pl-3 opacity-80";
                                    let prefix = "";
                                    let codeContent = line;

                                    if (isAdd) {
                                        bgClass = "bg-emerald-950/30 border-l-2 border-emerald-500 pl-3";
                                        prefix = "+ ";
                                        codeContent = line.substring(1);
                                    } else if (isDel) {
                                        bgClass = "bg-rose-950/30 border-l-2 border-rose-500 pl-3";
                                        prefix = "- ";
                                        codeContent = line.substring(1);
                                    }

                                    return (
                                        <div key={idx} className={`whitespace-pre py-0.5 ${bgClass}`}>
                                            {prefix && (
                                                <span className={isAdd ? "text-emerald-500 font-bold mr-1 select-none" : "text-rose-500 font-bold mr-1 select-none"}>
                                                    {prefix}
                                                </span>
                                            )}
                                            {isAdd || isDel || (!line.startsWith('diff') && !line.startsWith('index') && !line.startsWith('---') && !line.startsWith('+++') && !line.startsWith('@@')) ? (
                                                <span dangerouslySetInnerHTML={{ __html: highlightCodeLine(codeContent) }} />
                                            ) : (
                                                <span className={line.startsWith('@@') ? "text-cyan-400 font-semibold" : "text-zinc-500 italic"}>{line}</span>
                                            )}
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