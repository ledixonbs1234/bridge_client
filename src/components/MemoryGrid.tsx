// filepath: ridge_client/src/components/MemoryGrid.tsx
import { useEffect, useState, useMemo } from "react";
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
  theme?: "light" | "dark";
}

export function MemoryGrid({ reloadTrigger, theme = "light" }: MemoryGridProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState({ total: 0, avg_trust: 0, embedded_count: 0 });
  const [graphCode, setGraphCode] = useState<string>("");
  const [showGraph, setShowGraph] = useState<boolean>(true);
  const [consolidating, setConsolidating] = useState(false);
  const [resolvingConflicts, setResolvingConflicts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc tìm kiếm động (Dynamic Search & Filter)
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "episodic" | "semantic" | "procedural">("all");

  const isDark = theme === "dark";

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

  // Quản lý lọc tìm kiếm danh sách tri thức
  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      const matchSearch = (m.situation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.solution?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.tags?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchType = filterType === "all" || (m.type || "episodic") === filterType;
      return matchSearch && matchType;
    });
  }, [memories, searchQuery, filterType]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-left font-mono">
        ❌ Không thể kết nối hoặc tải dữ liệu FluxMem: {error}
      </div>
    );
  }

  // Phân loại nhãn chín muồi
  const getPemsBadge = (score: number) => {
    if (score >= 0.7) {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Chín muồi (Mature)</span>;
    } else if (score >= 0.3) {
      return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">Đang kiểm chứng</span>;
    }
    return <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/10">Sơ khai (Draft)</span>;
  };

  return (
    <div className={`space-y-6 text-left transition-colors duration-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>

      {/* 4 THẺ CHỈ SỐ HOÀN TOÀN TRỰC QUAN THEME */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng số lượng bộ nhớ", value: stats.total ?? 0, colorClass: isDark ? "text-zinc-100" : "text-zinc-900" },
          { label: "Điểm tin cậy trung bình", value: Number(stats.avg_trust ?? 0.7).toFixed(2), colorClass: "text-emerald-500" },
          { label: "Số lượng Vector nhúng", value: stats.embedded_count ?? 0, colorClass: isDark ? "text-zinc-100" : "text-zinc-900" }
        ].map((item, idx) => (
          <div key={idx} className={`border p-4 rounded-xl text-left shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
            }`}>
            <h3 className="text-xs text-zinc-400 mb-1">{item.label}</h3>
            <div className={`text-2xl font-bold ${item.colorClass}`}>{item.value}</div>
          </div>
        ))}

        <div className={`border p-4 rounded-xl flex items-center justify-between text-left col-span-1 shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <div>
            <h3 className="text-xs text-zinc-400 mb-1">FluxMem Engine</h3>
            <span className="text-[10px] text-zinc-500 block mt-0.5">Sleep-Time Optimization</span>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button
              onClick={triggerConsolidate}
              disabled={consolidating || resolvingConflicts}
              variant="outline"
              className={`text-[10px] h-7 px-2.5 font-bold cursor-pointer transition-colors ${isDark ? "border-amber-500/30 text-amber-500 hover:bg-amber-500/10" : "text-amber-600 border-amber-300 hover:bg-amber-50"
                }`}
            >
              {consolidating ? "Consolidating..." : "Distill (Chưng cất)"}
            </Button>
            <Button
              onClick={triggerResolveConflicts}
              disabled={resolvingConflicts || consolidating}
              variant="outline"
              className={`text-[10px] h-7 px-2.5 font-bold cursor-pointer transition-colors ${isDark ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "text-blue-600 border-blue-300 hover:bg-blue-50"
                }`}
            >
              {resolvingConflicts ? "Resolving..." : "Resolve (Đối chiếu)"}
            </Button>
          </div>
        </div>
      </div>

      {graphCode && (
        <div className={`border rounded-xl overflow-hidden text-left p-4 shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <div className={`flex justify-between items-center border-b pb-2 mb-4 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-zinc-300" : "text-zinc-500"}`}>
              <span>🧠</span> Bản đồ liên kết tri thức (FluxMem Graph Network)
            </h3>
            <button
              onClick={() => setShowGraph(!showGraph)}
              className="text-xs text-blue-500 hover:underline cursor-pointer border-none bg-transparent font-semibold"
            >
              {showGraph ? "Ẩn sơ đồ [-]" : "Hiện sơ đồ [+]"}
            </button>
          </div>

          {showGraph && (
            <div className={`rounded-lg p-2 border transition-colors ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
              }`}>
              <MermaidRenderer code={graphCode} />
            </div>
          )}
        </div>
      )}

      {/* FILTER & SEARCH PANEL */}
      <div className={`p-4 border rounded-xl flex flex-wrap gap-3 items-center justify-between shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
        }`}>
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="🔍 Tìm kiếm bài học, quy trình, công nghệ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 py-1.5 border rounded-lg text-xs outline-none transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-zinc-700" : "bg-white border-zinc-200 placeholder-zinc-400 focus:border-zinc-350"
              }`}
          />
        </div>
        <div className="flex items-center gap-2 select-none text-xs font-semibold">
          <span className="text-zinc-400">Bộ lọc lớp:</span>
          <div className={`flex rounded-lg p-0.5 border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-zinc-100 border-zinc-200"}`}>
            {[
              { id: "all", label: "Tất cả" },
              { id: "episodic", label: "Episodic" },
              { id: "semantic", label: "Semantic" },
              { id: "procedural", label: "Procedural" }
            ].map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilterType(btn.id as any)}
                className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${filterType === btn.id
                  ? (isDark ? "bg-zinc-800 text-zinc-100 font-bold" : "bg-white text-zinc-800 shadow-3xs")
                  : "text-zinc-400 hover:text-zinc-650"
                  }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MEMORIES LIST TABLE */}
      <div className={`border rounded-xl overflow-hidden shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
        }`}>
        <div className={`p-4 border-b flex justify-between items-center transition-colors duration-200 ${isDark ? "bg-zinc-950/40 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
          }`}>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-zinc-300" : "text-zinc-500"}`}>
            Memories List (Heterogeneous Layers)
          </h3>
          <button onClick={loadMemories} className="text-xs text-blue-500 hover:underline cursor-pointer border-none bg-transparent">
            Làm mới dữ liệu
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-zinc-700">
            <thead className={`border-b text-zinc-500 transition-colors ${isDark ? "bg-zinc-950/60 border-zinc-800" : "bg-zinc-50 border-zinc-200"
              }`}>
              <tr>
                <th className="p-3 font-semibold text-left border-zinc-200">Độ Chín Muồi (PEMS Score)</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Phân lớp</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Tình huống / Bối cảnh</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Giải pháp / Quy trình</th>
                <th className="p-3 font-semibold text-left border-zinc-200">Sử dụng</th>
              </tr>
            </thead>
            <tbody className={`divide-y transition-colors ${isDark ? "divide-zinc-800/60" : "divide-zinc-200"}`}>
              {filteredMemories.map((m) => {
                const trustScore = m.trust_score ?? 0.7;
                const solutionText = m.solution || "";
                return (
                  <tr key={m.id} className={isDark ? "hover:bg-zinc-850/40" : "hover:bg-zinc-50/50"}>
                    <td className="p-3 font-mono text-left border-zinc-200 min-w-[170px]">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-blue-500 font-bold">{Number(trustScore).toFixed(2)}</span>
                          {getPemsBadge(trustScore)}
                        </div>
                        {/* Gradient Progress Bar */}
                        <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`}>
                          <div
                            style={{ width: `${Math.min(100, trustScore * 100)}%` }}
                            className={`h-full rounded-full ${trustScore >= 0.7 ? "bg-emerald-500" : trustScore >= 0.3 ? "bg-amber-500" : "bg-zinc-500"
                              }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-left border-zinc-200">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.type === "procedural"
                          ? (isDark ? "bg-amber-950/30 border border-amber-900/60 text-amber-400" : "bg-amber-100 text-amber-800 border border-amber-200")
                          : m.type === "semantic"
                            ? (isDark ? "bg-emerald-950/30 border border-emerald-900/60 text-emerald-400" : "bg-emerald-100 text-emerald-800 border border-emerald-200")
                            : (isDark ? "bg-blue-950/30 border border-blue-900/60 text-blue-400" : "bg-blue-100 text-blue-800 border border-blue-200")
                          }`}
                      >
                        {m.type || "episodic"}
                      </span>
                    </td>
                    <td className={`p-3 font-semibold truncate max-w-xs text-left border-zinc-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      {m.situation || "—"}
                    </td>
                    <td className="p-3 text-zinc-400 font-mono whitespace-pre-wrap break-all max-w-sm text-left border-zinc-200">
                      {solutionText.substring(0, 120)}
                      {solutionText.length > 120 ? "..." : ""}
                    </td>
                    <td className="p-3 font-mono text-zinc-500 text-left border-zinc-200">{m.use_count ?? 0}</td>
                  </tr>
                );
              })}
              {filteredMemories.length === 0 && (
                <tr>
                  <td colSpan={5} className={`p-8 text-center text-zinc-400 border-zinc-200 italic ${isDark ? "bg-zinc-950/40" : "bg-white"}`}>
                    Chưa có bản ghi bộ nhớ nào được tìm thấy khớp với bộ lọc.
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