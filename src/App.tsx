// filepath: bridge_client/src/App.tsx
import { useState, useEffect } from "react";
import { useSSE } from "./hooks/useSSE";
import { WebTerminal } from "./components/WebTerminal";
import { Telemetry } from "./components/Telemetry";
import { TraceViewer } from "./components/TraceViewer";
import { MemoryGrid } from "./components/MemoryGrid";
import { TelegramConfig } from "./components/TelegramConfig";
import { SandboxManager } from "./components/SandboxManager";
import { highlightCodeLine } from "./lib/utils";

type TabPanel = "terminal" | "telemetry" | "traces" | "memory" | "telegram" | "sandbox";

export interface WorkspaceData {
  success: boolean;
  provider: {
    key: string;
    name: string;
    model: string;
  };
  agents: Array<{
    id: string;
    name: string;
    type: string;
    provider: string;
    model: string;
    tools: string[];
    toolCalls: any[];
    status: {
      state: "idle" | "running" | "waiting" | "thinking";
      currentTask?: string;
      progress: number;
      lastUpdate: number;
    };
  }>;
  pipeline: {
    pipeline_name: string;
    status: "PENDING" | "IN_PROGRESS" | "DONE" | "FAILED";
    stages: Array<{
      name: string;
      status: string;
      steps: Array<{
        step_key: string;
        task: string;
        tool: string;
        parallel_group: string | null;
        depends_on: string[];
      }>;
    }>;
  } | null;
  states: Array<{
    step_key: string;
    state: "PENDING" | "QUEUED" | "RUNNING" | "VALIDATING" | "DONE" | "FAILED" | "BLOCKED";
    retry_count: number;
    error_history: string;
    updated_at: string;
    summary?: string;
  }>;
  activeTask?: {
    step_key: string;
    description: string;
  };
}

interface ShadowChange {
  id?: string;          // Thêm thuộc tính id định danh duy nhất cho từng khung
  file: string;
  absolute_path: string;
  status: "added" | "modified" | "deleted" | string;
  additions: number;
  deletions: number;
  diff: string;
  latest_diff?: string;
  latest_additions?: number;
  latest_deletions?: number;
  timestamp?: number;   // Thêm mốc thời gian ghi nhận thay đổi
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabPanel>("terminal");
  const [goal, setGoal] = useState<string | null>(null);

  const [activeAgent] = useState<"MaxHermes" | "MaxClaw">("MaxHermes");
  const [activeModel, setActiveModel] = useState<string>("MiniMax-M3");
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);
  const [shadowChanges, setShadowChanges] = useState<ShadowChange[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<ShadowChange | null>(null);
  const [diffMode, setDiffMode] = useState<'cumulative' | 'latest'>('latest');
  const sse = useSSE(() => {
    setReloadTrigger((prev) => prev + 1);
    fetchWorkspace();
    fetchShadowChanges();
  });

  const fetchWorkspace = () => {
    fetch("/api/dashboard/active-workspace")
      .then((res) => {
        if (!res.ok) throw new Error("Mất kết nối HTTP");
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setWorkspaceData(data);
          setIsServerConnected(true);
          if (data.provider) {
            setActiveModel(data.provider.model);
          }
        }
      })
      .catch((err) => {
        console.error("Error reading active workspace state:", err);
        setIsServerConnected(false);
      });
  };

  const fetchShadowChanges = () => {
    fetch("/api/dashboard/shadow-changes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShadowChanges((prevHistory) => {
            const incomingChanges = data.changes || [];
            
            // Nếu không còn tệp nào đang trong phiên giao dịch, xóa sạch lịch sử
            if (incomingChanges.length === 0) {
              return [];
            }

            let newHistory = [...prevHistory];

            incomingChanges.forEach((incoming: ShadowChange) => {
              // Tìm các thẻ lịch sử đã lưu của tệp tin cụ thể này
              const fileHistory = newHistory.filter(h => h.absolute_path === incoming.absolute_path);
              
              if (fileHistory.length === 0) {
                // Nếu là lần đầu tiên tệp này thay đổi, tạo thẻ mới đầu tiên
                newHistory.push({
                  ...incoming,
                  id: `shadow_${incoming.file.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  timestamp: Date.now()
                });
              } else {
                // Lấy thẻ thay đổi gần đây nhất của tệp này để đối chiếu
                const latestCard = fileHistory[fileHistory.length - 1];
                
                // Nếu nội dung diff mới khác với diff của thẻ gần nhất -> Người dùng vừa thực hiện sửa đổi mới
                if (latestCard.diff !== incoming.diff) {
                  newHistory.push({
                    ...incoming,
                    id: `shadow_${incoming.file.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    timestamp: Date.now()
                  });
                }
              }
            });

            // Lọc bỏ các thẻ lịch sử của tệp tin nếu tệp đó không còn nằm trong danh sách cách ly của server 
            // (Ví dụ tệp đã được committed thành công hoặc đã rollback hoàn toàn)
            const activePaths = new Set(incomingChanges.map((c: ShadowChange) => c.absolute_path));
            newHistory = newHistory.filter(h => activePaths.has(h.absolute_path));

            return newHistory;
          });
        }
      })
      .catch((err) => console.error("Error fetching shadow changes:", err));
  };

  useEffect(() => {
    fetch("/api/dashboard/sessions")
      .then((res) => res.json())
      .then((data) => setGoal(data.currentGoal || null))
      .catch(() => setIsServerConnected(false));

    fetchWorkspace();
    fetchShadowChanges();

    const interval = setInterval(() => {
      fetchWorkspace();
      fetchShadowChanges();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedDiff(null);
      }
    };
    if (selectedDiff) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedDiff]);

  // Tự động tìm kiếm và cuộn khung nhìn đến dòng thay đổi đầu tiên khi mở Modal
  useEffect(() => {
    if (selectedDiff) {
      const timer = setTimeout(() => {
        const firstChangeEl = document.querySelector('.diff-line-add, .diff-line-del');
        if (firstChangeEl) {
          firstChangeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedDiff, diffMode]);

  // Bộ dò tìm và mở hộp thoại Diff từ đường dẫn tệp tin (Đồng bộ tuyệt đối)
  const handleViewDiffByPath = (filePath: string) => {
    if (!filePath) return;
    const cleanInputPath = filePath.replace(/\\/g, '/').toLowerCase();

    // 1. Dò tìm chính xác bằng absolute_path tuyệt đối trong bộ nhớ đệm Sandbox
    const foundInShadow = shadowChanges.find(c => {
      const cleanAbs = c.absolute_path.replace(/\\/g, '/').toLowerCase();
      return cleanAbs === cleanInputPath || cleanAbs.endsWith(cleanInputPath) || cleanInputPath.endsWith(cleanAbs);
    });

    if (foundInShadow) {
      setDiffMode('latest');
      setSelectedDiff(foundInShadow);
    } else {
      // 2. Dự phòng: Dò tìm bằng absolute_path tuyệt đối trong Git changes thực tế
      fetch("/api/dashboard/code-changes")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.changes)) {
            const matched = data.changes.find((c: any) => {
              const cAbs = (c.absolute_path || c.file).replace(/\\/g, '/').toLowerCase();
              return cAbs === cleanInputPath || cAbs.endsWith(cleanInputPath) || cleanInputPath.endsWith(cAbs);
            });

            if (matched) {
              setDiffMode('latest');
              setSelectedDiff({
                file: matched.file,
                absolute_path: matched.absolute_path || matched.file,
                status: matched.status,
                additions: matched.additions,
                deletions: matched.deletions,
                diff: matched.diff,
                latest_diff: matched.diff,
                latest_additions: matched.additions,
                latest_deletions: matched.deletions
              });
            } else {
              alert(`Không tìm thấy dữ liệu thay đổi cho tệp: ${filePath.split('/').pop()}`);
            }
          }
        })
        .catch(() => {
          alert(`Không tìm thấy dữ liệu thay đổi cho tệp: ${filePath.split('/').pop()}`);
        });
    }
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
          fetchShadowChanges();
          setSelectedDiff(null);
          setReloadTrigger((prev) => prev + 1);
        } else {
          alert("Lỗi khôi phục: " + data.error);
        }
      })
      .catch((err) => alert("Lỗi kết nối: " + err.message));
  };

  const handleEditGoal = () => {
    const nextGoal = prompt("Nhập mục tiêu (Goal) mới cho Agent:", goal || "");
    if (nextGoal === null) return;
    fetch("/api/dashboard/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: nextGoal }),
    })
      .then((res) => res.json())
      .then((data) => {
        setGoal(data.goal);
        fetchWorkspace();
      });
  };

  const handleClearGoal = () => {
    if (!confirm("Xóa mục tiêu hiện tại?")) return;
    fetch("/api/dashboard/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: null }),
    })
      .then((res) => res.json())
      .then(() => {
        setGoal(null);
        fetchWorkspace();
      });
  };

  return (
    <div className="min-h-screen bg-white text-zinc-800 flex flex-col font-sans antialiased overflow-hidden h-screen select-none">
      {!isServerConnected && (
        <div className="bg-red-600 text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 z-[9999] shadow-md shrink-0">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>⚠️ Mất kết nối tới Bridge Server. Hệ thống đang tự động kết nối lại...</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden h-full">
        <aside className="w-60 bg-zinc-50 border-r border-zinc-200 flex flex-col justify-between shrink-0 h-full text-zinc-700 overflow-y-auto">
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-2 px-1">
              <span className="text-blue-600 font-bold text-lg animate-pulse">⚡</span>
              <div>
                <h1 className="text-xs font-bold text-zinc-900 tracking-wide uppercase">Bridge Server</h1>
                <p className="text-[9px] text-zinc-400 font-medium">Intelligence Layer</p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("terminal")}
              className="flex items-center justify-center gap-2 w-full border border-zinc-200 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer"
            >
              <span className="text-sm font-bold">+</span> New task
            </button>

            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("traces")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "traces" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"}`}
              >
                <span className="text-sm">🔍</span> Search
              </button>
              <button
                onClick={() => setActiveTab("telemetry")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "telemetry" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"}`}
              >
                <span className="text-sm">📊</span> Skills
              </button>
              <button
                onClick={() => setActiveTab("terminal")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "terminal" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"}`}
              >
                <span className="text-sm">📅</span> Scheduled
              </button>
              <button
                onClick={() => setActiveTab("memory")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "memory" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"}`}
              >
                <span className="text-sm">🧠</span> Assets
              </button>
              <button
                onClick={() => setActiveTab("sandbox")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "sandbox" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"}`}
              >
                <span className="text-sm">🛡️</span> Shadow Files
              </button>
              <button
                onClick={() => setActiveTab("telegram")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "telegram" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"}`}
              >
                <span className="text-sm">✈️</span> Connect Mobile
              </button>
            </nav>

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Current Goal</span>
              <div className="px-3 py-2 bg-white border border-zinc-200 rounded-xl space-y-2">
                <p className="text-[11px] text-zinc-700 leading-normal line-clamp-3 select-text font-medium">
                  {goal || "Chưa thiết lập mục tiêu hiện tại."}
                </p>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={handleEditGoal} className="text-[9px] text-blue-600 hover:text-blue-500 font-bold cursor-pointer border-none bg-transparent">
                    Sửa
                  </button>
                  {goal && (
                    <button onClick={handleClearGoal} className="text-[9px] text-red-600 hover:text-red-500 font-bold cursor-pointer border-none bg-transparent">
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center px-3 mb-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Shadow Changes</span>
                {shadowChanges.length > 0 && (
                  <button
                    onClick={() => handleRollback()}
                    className="text-[9px] text-red-600 hover:underline font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
                    title="Khôi phục tất cả các tệp về nguyên trạng"
                  >
                    ↩️ Reset All
                  </button>
                )}
              </div>
              
              {shadowChanges.length === 0 ? (
                <div className="px-3 py-3 bg-white border border-zinc-200 rounded-xl">
                  <p className="text-[10px] text-zinc-400 italic font-medium">Không có thay đổi nào.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                  {shadowChanges.map((change) => (
                    <div 
                      key={change.id || change.file} 
                      className="bg-white border border-zinc-200 rounded-xl p-3 shadow-2xs flex items-center justify-between group hover:border-zinc-300 hover:shadow-xs transition-all"
                    >
                      <button
                        onClick={() => setSelectedDiff(change)}
                        className="flex-1 text-left flex flex-col transition-colors text-[11px] font-mono cursor-pointer border-none bg-transparent truncate"
                      >
                        <span className="text-zinc-750 font-bold truncate block" title={change.file}>
                          {change.file.split('/').pop()}
                        </span>
                        <span className="text-[9px] text-zinc-400 mt-0.5 flex gap-1.5">
                          {change.additions > 0 && <span className="text-emerald-600 font-bold">+{change.additions}</span>}
                          {change.deletions > 0 && <span className="text-rose-600 font-bold">-{change.deletions}</span>}
                          {change.additions === 0 && change.deletions === 0 && <span className="text-zinc-400">chưa thay đổi</span>}
                        </span>
                      </button>
                      <button
                        onClick={() => handleRollback(change.file)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-500 rounded-lg text-xs border-none bg-transparent cursor-pointer transition-opacity"
                        title={`Khôi phục tệp ${change.file.split('/').pop()} về nguyên trạng`}
                      >
                        ↩️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-zinc-200 flex items-center justify-between select-none bg-zinc-100/30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-500/10">
                XL
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-800 leading-none">Xơn Lê</p>
                <p className="text-[10px] text-zinc-400 font-medium mt-1">Administrator</p>
              </div>
            </div>
            <button title="Download logs" className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-1 border-none bg-transparent">
              📥
            </button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col bg-white overflow-hidden h-full relative">
          {activeTab === "terminal" ? (
            <WebTerminal
              activeAgent={activeAgent}
              activeModel={activeModel}
              setActiveModel={setActiveModel}
              sse={sse}
              workspaceData={workspaceData}
              onViewDiff={handleViewDiffByPath}
            />
          ) : activeTab === "traces" ? (
            // --- NÂNG CẤP ĐẶC BIỆT: Bóc tách Trace khỏi container chật hẹp, mở rộng 100% chiều cao và chiều rộng như Search/Terminal ---
            <div className="flex-1 flex flex-col overflow-hidden h-full bg-white text-zinc-800 border-l border-zinc-200 animate-fade-in">
              <header className="px-6 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50 select-none shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <span>🔍</span> Trace Viewer
                  </h2>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">Workspace điều khiển & Phân tích tối ưu hệ thống Agent</p>
                </div>
                <button
                  onClick={() => setActiveTab("terminal")}
                  className="text-xs text-blue-600 hover:underline cursor-pointer border-none bg-transparent font-semibold"
                >
                  ← Trở lại khung Chat
                </button>
              </header>

              <div className="flex-1 overflow-hidden p-6 bg-zinc-50/10 h-full w-full">
                <TraceViewer reloadTrigger={reloadTrigger} onViewDiff={handleViewDiffByPath} />
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white text-zinc-800 p-8 overflow-y-auto select-text border-l border-zinc-200">
              <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-4 select-none">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                      <span>⚡</span>{" "}
                      {activeTab === "telemetry"
                        ? "Telemetry Report"
                        : activeTab === "memory"
                          ? "FluxMem Layer"
                          : activeTab === "sandbox"
                            ? "Shadow Transaction Manager"
                            : "Telegram Config"}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">Workspace điều khiển & Phân tích tối ưu hệ thống Agent</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("terminal")}
                    className="text-xs text-blue-600 hover:underline cursor-pointer border-none bg-transparent font-semibold"
                  >
                    ← Trở lại khung Chat
                  </button>
                </div>

                {activeTab === "telemetry" && <Telemetry reloadTrigger={reloadTrigger} />}
                {activeTab === "memory" && <MemoryGrid reloadTrigger={reloadTrigger} />}
                {activeTab === "sandbox" && <SandboxManager reloadTrigger={reloadTrigger} />}
                {activeTab === "telegram" && <TelegramConfig />}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* SHADOW FILES INTERACTIVE DIFF MODAL (LIGHTBOX) WITH MULTI-COLOR HIGHLIGHTING */}
      {selectedDiff && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-xs z-[99999] flex items-center justify-center p-4 select-text">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-4xl h-[80vh] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in text-zinc-800">

            {/* Header */}
            <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex justify-between items-center select-none shrink-0">
              <div className="text-left max-w-[50%]">
                <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📊</span> So sánh chi tiết tệp Sandbox
                </h3>
                <p className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate" title={selectedDiff.absolute_path}>
                  {selectedDiff.absolute_path}
                </p>
              </div>

              {/* Nút bấm chuyển đổi chế độ xem */}
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-zinc-100 rounded-lg border border-zinc-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setDiffMode('latest')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${diffMode === 'latest'
                      ? 'bg-white text-zinc-800 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                  >
                    Lần sửa gần nhất
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiffMode('cumulative')}
                    className={`px-3 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${diffMode === 'cumulative'
                      ? 'bg-white text-zinc-800 shadow-xs'
                      : 'text-zinc-400 hover:text-zinc-600'
                      }`}
                  >
                    Lũy kế phiên
                  </button>
                </div>

                <button
                  onClick={() => setSelectedDiff(null)}
                  className="px-3.5 py-1.5 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-bold text-zinc-700 cursor-pointer transition-colors"
                >
                  Đóng [Esc]
                </button>
              </div>
            </div>

            {/* Diff View Area - CHỈ HIỂN THỊ DÒNG THAY ĐỔI + CONTEXT GIỚI HẠN */}
            <div className="flex-1 overflow-auto p-6 bg-zinc-900 text-zinc-100 font-mono text-sm leading-relaxed text-left">
              {(() => {
                const targetDiff = diffMode === 'latest'
                  ? (selectedDiff.latest_diff || selectedDiff.diff)
                  : selectedDiff.diff;

                if (!targetDiff) {
                  return (
                    <div className="text-zinc-400 italic text-center py-20">
                      Không phát hiện thay đổi nào thuộc chế độ xem này.
                    </div>
                  );
                }

                // Parse tất cả các dòng và đánh dấu index của dòng thay đổi
                const allLines = targetDiff.split('\n');
                const changeIndices: number[] = [];

                allLines.forEach((line, idx) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');
                  if (isAdd || isDel) {
                    changeIndices.push(idx);
                  }
                });

                // Tạo tập hợp các index cần hiển thị (change + 3 dòng context trước/sau)
                const visibleIndices = new Set<number>();
                const CONTEXT_SIZE = 3;

                changeIndices.forEach(changeIdx => {
                  for (let i = Math.max(0, changeIdx - CONTEXT_SIZE); i <= Math.min(allLines.length - 1, changeIdx + CONTEXT_SIZE); i++) {
                    visibleIndices.add(i);
                  }
                });

                // Render có gộp nhóm và thêm dấu "..." khi bỏ qua đoạn dài
                const renderLines: any[] = [];
                let prevVisibleIdx = -10; // Khởi tạo giá trị âm đủ lớn

                Array.from(visibleIndices).sort((a, b) => a - b).forEach((idx) => {
                  // Nếu khoảng cách giữa 2 dòng hiển thị > 1, chèn dấu "..."
                  if (idx - prevVisibleIdx > 1) {
                    renderLines.push(
                      <div key={`ellipsis-${idx}`} className="py-1 px-3 text-zinc-500 text-xs select-none">
                        ... ({idx - prevVisibleIdx - 1} dòng không thay đổi đã được ẩn)
                      </div>
                    );
                  }

                  const line = allLines[idx];
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');

                  let colorClass = "text-zinc-500 opacity-60";
                  let bgClass = "pl-3";

                  if (isAdd) {
                    colorClass = "text-emerald-400 font-semibold diff-line-add";
                    bgClass = "bg-emerald-950/45 border-l-2 border-emerald-500 pl-3";
                  } else if (isDel) {
                    colorClass = "text-rose-400 font-semibold diff-line-del";
                    bgClass = "bg-rose-950/45 border-l-2 border-rose-500 pl-3";
                  } else {
                    bgClass = "pl-3 opacity-80";
                  }

                  const codeContent = (isAdd || isDel) ? line.substring(1) : line;
                  const highlightedHtml = highlightCodeLine(codeContent);

                  renderLines.push(
                    <div key={idx} className={`whitespace-pre py-0.5 leading-normal ${bgClass} ${colorClass}`}>
                      {isAdd && <span className="text-emerald-500 font-bold mr-1 select-none">+ </span>}
                      {isDel && <span className="text-rose-500 font-bold mr-1 select-none">- </span>}
                      <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    </div>
                  );

                  prevVisibleIdx = idx;
                });

                return <div className="font-mono space-y-0.5">{renderLines}</div>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}