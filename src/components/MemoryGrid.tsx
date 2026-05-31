// bridge_client/src/components/MemoryGrid.tsx
import { useEffect, useState } from "react";
import { Button } from "./animate-ui/button";
import { MermaidRenderer } from "./MermaidRenderer";

interface Memory {
  id: number;
  date: string;
  situation?: string;
  solution?: string;
  tags?: string;
  trust_score?: number;
  use_count?: number;
  type?: "episodic" | "semantic" | "procedural" | string;
}

export function MemoryGrid() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState({ total: 0, avg_trust: 0, embedded_count: 0 });
  const [graphCode, setGraphCode] = useState<string>("");
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [consolidating, setConsolidating] = useState(false);
  const [resolvingConflicts, setResolvingConflicts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = () => {
    // 1. Tải bảng dữ liệu và thông số thống kê
    fetch("/api/dashboard/memories")
      .then((res) => {
        if (!res.ok) throw new Error("Lỗi API: " + res.status);
        return res.json();
      })
      .then((data) => {
        setMemories(data.memories || []);
        setStats(data.stats || { total: 0, avg_trust: 0, embedded_count: 0 });
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      });

    // 2. Tải mã đồ thị liên kết Mermaid
    fetch("/api/dashboard/memories/graph")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.graph) {
          setGraphCode(data.graph);
        }
      })
      .catch((err) => console.error("Không thể tải sơ đồ đồ thị bộ nhớ:", err));
  };

  const triggerConsolidate = () => {
    if (!confirm("Bắt đầu tiến trình FluxMem Stage III Offline Consolidation?")) return;
    setConsolidating(true);
    fetch("/api/dashboard/consolidate", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Consolidation API failed");
        return res.json();
      })
      .then(() => {
        alert("Hợp nhất thành công các quy trình dài hạn!");
        loadMemories();
      })
      .catch((err) => alert("Lỗi chưng cất: " + err.message))
      .finally(() => setConsolidating(false));
  };

  const triggerResolveConflicts = () => {
    if (!confirm("Bắt đầu tiến trình tự động đối chiếu và giải quyết xung đột kĩ thuật trong bộ nhớ?")) return;
    setResolvingConflicts(true);
    fetch("/api/dashboard/resolve-conflicts", { method: "POST" })
      .then((res) => {
        if (!res.ok) throw new Error("Resolve API failed");
        return res.json();
      })
      .then((data) => {
        alert(data.message || "Đối chiếu và xử lý hoàn tất!");
        loadMemories();
      })
      .catch((err) => alert("Lỗi đối chiếu xung đột: " + err.message))
      .finally(() => setResolvingConflicts(false));
  };

  if (error) {
    return (
      <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-xl text-red-400 text-sm text-left font-mono">
        ❌ Không thể kết nối hoặc tải dữ liệu FluxMem: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* THÔNG SỐ BỘ NHỚ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-left">
          <h3 className="text-xs text-zinc-400 mb-1">Tổng số lượng bộ nhớ</h3>
          <div className="text-2xl font-bold">{stats.total ?? 0}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-left">
          <h3 className="text-xs text-zinc-400 mb-1">Điểm tin cậy trung bình</h3>
          <div className="text-2xl font-bold text-emerald-400">
            {Number(stats.avg_trust ?? 0.7).toFixed(2)}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-left">
          <h3 className="text-xs text-zinc-400 mb-1">Số lượng Vector nhúng</h3>
          <div className="text-2xl font-bold">{stats.embedded_count ?? 0}</div>
        </div>

        {/* WIDGET ĐIỀU KHIỂN FLUXMEM: Tích hợp 2 nút bấm xếp cột dọc */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between text-left col-span-1">
          <div>
            <h3 className="text-xs text-zinc-400 mb-1">FluxMem Engine</h3>
            <span className="text-[10px] text-zinc-500">Sleep-Time Optimization</span>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              onClick={triggerConsolidate}
              disabled={consolidating || resolvingConflicts}
              variant="outline"
              className="text-[10px] h-7 px-2.5 text-amber-400 border-amber-500/30 font-semibold cursor-pointer"
            >
              {consolidating ? "Consolidating..." : "💤 Chưng cất"}
            </Button>
            <Button
              onClick={triggerResolveConflicts}
              disabled={resolvingConflicts || consolidating}
              variant="outline"
              className="text-[10px] h-7 px-2.5 text-blue-400 border-blue-500/30 font-semibold cursor-pointer"
            >
              {resolvingConflicts ? "Resolving..." : "⚖️ Đối chiếu"}
            </Button>
          </div>
        </div>
      </div>

      {/* ĐỒ THỊ TRỰC QUAN HÓA MERMAID */}
      {graphCode && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-left p-4">
          <div className="flex justify-between items-center border-b border-zinc-850 pb-2 mb-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <span>🧠</span> Bản đồ liên kết tri thức (FluxMem Graph Network)
            </h3>
            <button
              onClick={() => setShowGraph(!showGraph)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showGraph ? "Ẩn sơ đồ [-]" : "Hiện sơ đồ [+]"}
            </button>
          </div>

          {showGraph && (
            <div className="bg-zinc-950/20 rounded-lg p-2 border border-zinc-800/40">
              <MermaidRenderer code={graphCode} />
            </div>
          )}
        </div>
      )}

      {/* BẢNG BỘ NHỚ CHI TIẾT */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-left">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Memories List (Heterogeneous Layers)
          </h3>
          <button
            onClick={loadMemories}
            className="text-xs text-blue-400 hover:underline"
          >
            Làm mới dữ liệu
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-300">
            <thead className="bg-zinc-950/40 border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="p-3 font-semibold text-left">Mức tin cậy</th>
                <th className="p-3 font-semibold text-left">Phân lớp</th>
                <th className="p-3 font-semibold text-left">Tình huống / Bối cảnh</th>
                <th className="p-3 font-semibold text-left">Giải pháp / Quy trình</th>
                <th className="p-3 font-semibold text-left">Sử dụng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {memories.map((m) => {
                const trustScore = m.trust_score ?? 0.7;
                const solutionText = m.solution || "";
                return (
                  <tr key={m.id} className="hover:bg-zinc-800/10">
                    <td className="p-3 font-mono font-bold text-blue-400 text-left">
                      {Number(trustScore).toFixed(2)}
                    </td>
                    <td className="p-3 text-left">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === "procedural"
                          ? "bg-amber-500/10 text-amber-400"
                          : m.type === "semantic"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-blue-500/10 text-blue-400"
                          }`}
                      >
                        {m.type || "episodic"}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-zinc-200 truncate max-w-xs text-left">
                      {m.situation || "—"}
                    </td>
                    <td className="p-3 text-zinc-400 font-mono whitespace-pre-wrap break-all max-w-sm text-left">
                      {solutionText.substring(0, 120)}
                      {solutionText.length > 120 ? "..." : ""}
                    </td>
                    <td className="p-3 font-mono text-zinc-500 text-left">{m.use_count ?? 0}</td>
                  </tr>
                );
              })}
              {memories.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-500">
                    Chưa có bản ghi bộ nhớ nào được lưu trữ.
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