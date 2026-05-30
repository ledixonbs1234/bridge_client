import { useEffect, useState } from "react";
import { Button } from "./animate-ui/button";

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
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = () => {
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
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex items-center justify-between text-left">
          <div>
            <h3 className="text-xs text-zinc-400 mb-1">FluxMem Offline</h3>
            <span className="text-[10px] text-zinc-500">Sleep-Time Consolidation</span>
          </div>
          <Button
            onClick={triggerConsolidate}
            disabled={consolidating}
            variant="outline"
            className="text-xs h-8 text-amber-400 border-amber-500/30"
          >
            {consolidating ? "Consolidating..." : "💤 Chưng cất"}
          </Button>
        </div>
      </div>

      {/* BẢNG BỘ NHỚ CHI TIẾT */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-left">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Memories List (Heterogeneous Layers)
          </h3>
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
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.type === "procedural"
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