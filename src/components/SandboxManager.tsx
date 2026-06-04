import { useEffect, useState } from "react";
import { Button } from "./animate-ui/button";

interface Sandbox {
    id: number;
    task_id: string;
    branch: string;
    worktree: string;
    status: "active" | "accepted" | "rejected" | string;
    parent_branch: string;
    created_at: string;
}

interface SandboxManagerProps {
    reloadTrigger: number;
}

export function SandboxManager({ reloadTrigger }: SandboxManagerProps) {
    const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
    const [activeWorkspace, setActiveWorkspace] = useState<string>("");
    const [isIsolated, setIsIsolated] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        loadSandboxes();
    }, [reloadTrigger]);

    const loadSandboxes = () => {
        setLoading(true);
        fetch("/api/dashboard/sandboxes")
            .then((res) => {
                if (!res.ok) throw new Error("Không thể kết nối đến máy chủ");
                return res.json();
            })
            .then((data) => {
                if (data.success) {
                    setSandboxes(data.sandboxes || []);
                    setActiveWorkspace(data.active_workspace || "");
                    setIsIsolated(data.is_isolated || false);
                }
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    };

    const handleAccept = (taskId: string) => {
        if (!confirm(`Bạn có chắc chắn muốn trộn thay đổi từ Sandbox ${taskId} vào nhánh chính không?\nThao tác này sẽ tự động commit code cát và dọn dẹp worktree.`)) return;
        setActionLoading(taskId);
        fetch("/api/dashboard/sandboxes/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.status === "success") {
                    alert(data.message);
                    loadSandboxes();
                } else {
                    throw new Error(data.error_message || data.error);
                }
            })
            .catch((err) => alert("Lỗi khi trộn code: " + err.message))
            .finally(() => setActionLoading(null));
    };

    const handleReject = (taskId: string) => {
        if (!confirm(`Bạn có chắc chắn muốn hủy bỏ toàn bộ thay đổi của Sandbox ${taskId} không?\nSơ đồ worktree và branch của task này sẽ bị xóa hoàn toàn.`)) return;
        setActionLoading(taskId);
        fetch("/api/dashboard/sandboxes/reject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.status === "success") {
                    alert(data.message);
                    loadSandboxes();
                } else {
                    throw new Error(data.error_message || data.error);
                }
            })
            .catch((err) => alert("Lỗi khi hủy sandbox: " + err.message))
            .finally(() => setActionLoading(null));
    };

    const handleCreateManual = () => {
        setLoading(true);
        fetch("/api/dashboard/sandboxes/create", { method: "POST" })
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    alert("Đã khởi tạo Sandbox Git Worktree mới thành công!");
                    loadSandboxes();
                } else {
                    throw new Error(data.error);
                }
            })
            .catch((err) => alert("Lỗi tạo sandbox: " + err.message))
            .finally(() => setLoading(false));
    };

    if (loading && sandboxes.length === 0) {
        return <div className="text-zinc-500 text-sm text-left">Đang tải trạng thái Sandbox...</div>;
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-left font-mono">
                ❌ Lỗi nạp Git Sandbox: {error}
            </div>
        );
    }

    return (
        <div className="space-y-6 text-left text-zinc-800 animate-fade-in">
            <div className="flex justify-between items-center bg-zinc-50 border border-zinc-200 p-4 rounded-xl shadow-xs">
                <div>
                    <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Thư mục hiện hành (Workspace)</h3>
                    <div className="text-sm font-mono font-bold text-zinc-800 break-all select-all">{activeWorkspace}</div>
                    <div className="flex items-center gap-1.5 mt-2">
                        <span className={`w-2 h-2 rounded-full ${isIsolated ? 'bg-amber-500 glow-amber animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase">
                            {isIsolated ? "ĐANG CHẠY TRONG SANDBOX CÁCH LY" : "WORKSPACE GỐC (CHƯA CÁCH LY)"}
                        </span>
                    </div>
                </div>

                <Button
                    onClick={handleCreateManual}
                    disabled={isIsolated}
                    variant="default"
                    className="text-xs font-semibold h-9 px-4 shrink-0 cursor-pointer"
                >
                    📦 Tạo Sandbox mới
                </Button>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                        Git Sandbox Logs & Worktrees
                    </h3>
                    <button onClick={loadSandboxes} className="text-xs text-blue-600 hover:underline cursor-pointer">
                        Làm mới dữ liệu
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-zinc-700">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                            <tr>
                                <th className="p-3 font-semibold text-left border-zinc-200">Task ID</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Trạng thái</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Nhánh cát (Branch)</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Nhánh gốc (Parent)</th>
                                <th className="p-3 font-semibold text-left border-zinc-200">Đường dẫn Sandbox (Worktree)</th>
                                <th className="p-3 font-semibold text-center border-zinc-200">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200">
                            {sandboxes.map((s) => {
                                const isActive = s.status === "active";
                                return (
                                    <tr key={s.id} className="hover:bg-zinc-50/50">
                                        <td className="p-3 font-mono font-bold text-zinc-900 text-left border-zinc-200">
                                            {s.task_id}
                                        </td>
                                        <td className="p-3 text-left border-zinc-200">
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${isActive
                                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                                    : s.status === "accepted"
                                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                                        : "bg-red-100 text-red-800 border border-red-200"
                                                    }`}
                                            >
                                                {s.status}
                                            </span>
                                        </td>
                                        <td className="p-3 font-mono text-blue-600 text-left border-zinc-200">
                                            {s.branch}
                                        </td>
                                        <td className="p-3 font-mono text-zinc-500 text-left border-zinc-200">
                                            {s.parent_branch || "main"}
                                        </td>
                                        <td className="p-3 font-mono text-zinc-500 truncate max-w-xs text-left border-zinc-200" title={s.worktree}>
                                            {s.worktree}
                                        </td>
                                        <td className="p-3 text-center border-zinc-200">
                                            {isActive ? (
                                                <div className="flex gap-1.5 justify-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleAccept(s.task_id)}
                                                        disabled={actionLoading !== null}
                                                        className="h-7 text-[10px] font-semibold text-emerald-600 border-emerald-200 hover:bg-emerald-50 cursor-pointer animate-fade-in"
                                                    >
                                                        {actionLoading === s.task_id ? "..." : "✓ Đồng ý (Merge)"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleReject(s.task_id)}
                                                        disabled={actionLoading !== null}
                                                        className="h-7 text-[10px] font-semibold text-red-600 border-red-200 hover:bg-red-50 cursor-pointer animate-fade-in"
                                                    >
                                                        {actionLoading === s.task_id ? "..." : "✗ Hủy bỏ (Reject)"}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-zinc-400 font-medium">Đã dọn dẹp</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {sandboxes.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-zinc-400 border-zinc-200 bg-white">
                                        Chưa có Sandbox nào từng được khởi tạo.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}