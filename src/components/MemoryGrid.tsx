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

interface MemoryGridProps {
  reloadTrigger: number;
}

export function MemoryGrid({ reloadTrigger }: MemoryGridProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState({ total: 0, avg_trust: 0, embedded_count: 0 });
  const [graphCode, setGraphCode] = useState<string>("");
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [consolidating, setConsolidating] = useState(false);
  const [resolvingConflicts, setResolvingConflicts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMemories();
  }, [reloadTrigger]);

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
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-left font-mono">
        ❌ Không thể kết nối hoặc tải dữ liệu FluxMem: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left text-zinc-800">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-left shadow-xs">
          <h3 className="text-xs text-zinc-400 mb-1">Tổng số lượng bộ nhớ</h3>
          <div className="text-2xl font-bold text-zinc-900">{stats.total ?? 0}</div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-left shadow-xs">
          <h3 className="text-xs text-zinc-400 mb-1">Điểm tin cậy trung bình</h3>
          <div className="text-2xl font-bold text-emerald-600">
            {Number(stats.avg_trust ?? 0.7).toFixed(2)}
          </div>
        </div>
        <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl text-left shadow-xs">
          <h3 className="text-xs text-zinc-400 mb-1">Số lượng Vector nhúng</h3>
          <div className="text-2xl font-bold text-zinc-900">{stats.embedded_count ?? 0}</div>
        </div>

        <div className="bg-zinc-50 border border-zinc-200 p-4 rounded-xl flex items-center justify-between text-left col-span-1 shadow-xs">
          <div>
            <h3 className="text-xs text-zinc-400 mb-1">FluxMem Engine</h3>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Sleep-Time Optimization</span>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              onClick={triggerConsolidate}
              disabled={consolidating || resolvingConflicts}
              variant="outline"
              className="text-[10px] h-7 px-2.5 text-amber-600 border-amber-300 hover:bg-amber-50 font-semibold cursor-pointer"
            >
              {consolidating ? "Consolidating..." : "💤 Chưng cất"}
            </Button>
            <Button
              onClick={triggerResolveConflicts}
              disabled={resolvingConflicts || consolidating}
              variant="outline"
              className="text-[10px] h-7 px-2.5 text-blue-600 border-blue-300 hover:bg-blue-50 font-semibold cursor-pointer"
            >
              {resolvingConflicts ? "Resolving..." : "⚖️ Đối chiếu"}
            </Button>
          </div>
        </div>
      </div>

      {graphCode && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden text-left p-4 shadow-xs">
          <div className="flex justify-between items-center border-b border-zinc-200 pb-2 mb-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <span>🧠</span> Bản đồ liên kết tri thức (FluxMem Graph Network)
            </h3>
            <button
              onClick={() => setShowGraph(!showGraph)}
              className="text-xs text-blue-600 hover:text-blue-500 transition-colors cursor-pointer"
            >
              {showGraph ? "Ẩn sơ đồ [-]" : "Hiện sơ đồ [+]"}
            </button>
          </div>

          {showGraph && (
            <div className="bg-white rounded-lg p-2 border border-zinc-200">
              <MermaidRenderer code={graphCode} />
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden text-left shadow-xs">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Memories List (Heterogeneous Layers)
          </h3>
          <button onClick={loadMemories} className="text-xs text-blue-600 hover:underline cursor-pointer">
            Làm mới dữ liệu
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-700">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="p-3 font-semibold text-left border-zinc-200">Mức tin cậy</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Phân lớp</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Tình huống / Bối cảnh</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Giải pháp / Quy trình</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Sử dụng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {memories.map((m) => {
                const trustScore = m.trust_score ?? 0.7;
                const solutionText = m.solution || "";
                return (
                  <tr key={m.id} className="hover:bg-zinc-50/50">
                    <td className="p-3 font-mono font-bold text-blue-600 text-left border-zinc-200">
                      {Number(trustScore).toFixed(2)}
                    </td>
                    <td className="p-3 text-left border-zinc-200">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === "procedural"
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : m.type === "semantic"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                          }`}
                      >
                        {m.type || "episodic"}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-zinc-800 truncate max-w-xs text-left border-zinc-200">
                      {m.situation || "—"}
                    </td>
                    <td className="p-3 text-zinc-500 font-mono whitespace-pre-wrap break-all max-w-sm text-left border-zinc-200">
                      {solutionText.substring(0, 120)}
                      {solutionText.length > 120 ? "..." : ""}
                    </td>
                    <td className="p-3 font-mono text-zinc-400 text-left border-zinc-200">{m.use_count ?? 0}</td>
                  </tr>
                );
              })}
              {memories.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-zinc-400 border-zinc-200 bg-white">
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