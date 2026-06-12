// filepath: ridge_client/src/App.tsx
import { useState, useEffect, useCallback } from "react";
import { useSSE } from "./hooks/useSSE";
import { VisualFlow } from "./components/terminal/VisualFlow";
import { Telemetry } from "./components/Telemetry";
import { TraceViewer } from "./components/TraceViewer";
import { MemoryGrid } from "./components/MemoryGrid";
import { TelegramConfig } from "./components/TelegramConfig";
import { SandboxManager } from "./components/SandboxManager";
import { GraphBuilder } from "./components/GraphBuilder";

import { SidebarHarnessList } from "./components/SidebarHarnessList";
import { SidebarShadowChanges } from "./components/SidebarShadowChanges";
import { DiffLightbox } from "./components/DiffLightbox";
import { HarnessRunModal } from "./components/HarnessRunModal";
import { highlightCodeLine } from "./lib/utils";

type TabPanel = "flow" | "telemetry" | "traces" | "memory" | "telegram" | "sandbox" | "builder";

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
    tool?: string;
  };
  harness_config?: {
    harness_name: string;
    description: string;
    initial_node: string;
    state_schema: any;
    nodes: Record<string, {
      type: "agent" | "validator";
      system_prompt?: string;
      tools?: string[];
      model_mode?: string;
      next?: string;
      validation_rule?: string;
      target_file_key?: string;
      next_on_success?: string;
      next_on_failure?: string;
    }>;
    edges: Array<{ from: string; to: string }>;
    conditional_edges?: Array<{
      from: string;
      condition_type: string;
      state_key: string;
      router: Record<string, string>;
    }>;
  };
}

interface ShadowChange {
  id?: string;
  file: string;
  absolute_path: string;
  status: "added" | "modified" | "deleted" | string;
  additions: number;
  deletions: number;
  diff: string;
  latest_diff?: string;
  latest_additions?: number;
  latest_deletions?: number;
  timestamp?: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabPanel>("flow");
  const [goal, setGoal] = useState<string | null>(null);

  const [activeAgent] = useState<"MaxHermes" | "MaxClaw">("MaxHermes");
  const [activeModel, setActiveModel] = useState<string>("MiniMax-M3");
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);
  const [shadowChanges, setShadowChanges] = useState<ShadowChange[]>([]);
  const [selectedDiff, setSelectedDiff] = useState<ShadowChange | null>(null);
  const [diffMode, setDiffMode] = useState<'cumulative' | 'latest'>('latest');

  const [harnesses, setHarnesses] = useState<any[]>([]);
  const [runningHarnessId, setRunningHarnessId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [editHarnessConfig, setEditHarnessConfig] = useState<any>(null);

  // Khởi tạo theme bền vững từ localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('bridge_flow_theme');
      return (saved === 'light' || saved === 'dark') ? saved : 'dark';
    } catch {
      return 'dark';
    }
  });

  // STEP 1 NÂNG CẤP: Đồng bộ hóa bền vững theme lên cấp độ DOM gốc ngăn nháy trắng khi refresh
  useEffect(() => {
    localStorage.setItem('bridge_flow_theme', theme);
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('bg-zinc-950');
    } else {
      root.classList.remove('dark');
      body.classList.remove('bg-zinc-950');
    }
  }, [theme]);

  const sse = useSSE(() => {
    setReloadTrigger((prev) => prev + 1);
    fetchWorkspace();
    fetchShadowChanges();
  });

  const fetchWorkspace = useCallback(() => {
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
        console.error("Lỗi đồng bộ hóa bối cảnh Workspace:", err);
        setIsServerConnected(false);
      });
  }, []);

  const fetchShadowChanges = useCallback(() => {
    fetch("/api/dashboard/shadow-changes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShadowChanges((prevHistory) => {
            const incomingChanges = data.changes || [];
            if (incomingChanges.length === 0) {
              return [];
            }

            let newHistory = [...prevHistory];

            incomingChanges.forEach((incoming: ShadowChange) => {
              const fileHistory = newHistory.filter(h => h.absolute_path === incoming.absolute_path);

              if (fileHistory.length === 0) {
                newHistory.push({
                  ...incoming,
                  id: `shadow_${incoming.file.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                  timestamp: Date.now()
                });
              } else {
                const latestCard = fileHistory[fileHistory.length - 1];
                if (latestCard.diff !== incoming.diff) {
                  newHistory.push({
                    ...incoming,
                    id: `shadow_${incoming.file.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    timestamp: Date.now()
                  });
                }
              }
            });

            const activePaths = new Set(incomingChanges.map((c: ShadowChange) => c.absolute_path));
            newHistory = newHistory.filter(h => activePaths.has(h.absolute_path));

            return newHistory;
          });
        }
      })
      .catch((err) => console.error("Lỗi đồng bộ Shadow Files:", err));
  }, []);

  const fetchHarnesses = useCallback(() => {
    fetch("/api/dashboard/harnesses")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setHarnesses(data.harnesses || []);
        }
      })
      .catch((err) => console.error("Không thể lấy danh sách sơ đồ FSM mẫu:", err));
  }, []);

  useEffect(() => {
    fetch("/api/dashboard/sessions")
      .then((res) => res.json())
      .then((data) => setGoal(data.currentGoal || null))
      .catch(() => setIsServerConnected(false));

    fetchWorkspace();
    fetchShadowChanges();
    fetchHarnesses();

    const interval = setInterval(() => {
      fetchWorkspace();
      fetchShadowChanges();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchWorkspace, fetchShadowChanges, fetchHarnesses, reloadTrigger]);

  const handleTriggerHarnessRun = (harnessId: string, taskPrompt: string) => {
    setTriggering(true);
    fetch("/api/dashboard/harnesses/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        harness_id: harnessId,
        task: taskPrompt
      })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          setRunningHarnessId(null);
          setReloadTrigger((prev) => prev + 1);
          setActiveTab("flow");
        } else {
          alert("Lỗi khởi chạy: " + data.error);
        }
      })
      .catch((err) => alert("Gặp sự cố kết nối: " + err.message))
      .finally(() => setTriggering(false));
  };
  const handleActivateHarness = (harnessId: string) => {
    fetch("/api/dashboard/harnesses/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ harness_id: harnessId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setReloadTrigger((prev) => prev + 1);
          fetchWorkspace();
          setActiveTab("flow"); // Chuyển đổi trực tiếp sang tab Visual Flow để xem
        } else {
          alert("Lỗi kích hoạt sơ đồ: " + data.error);
        }
      })
      .catch((err) => alert("Gặp sự cố kết nối: " + err.message));
  };
  const handleEditHarness = (harnessId: string) => {
    fetch(`/api/dashboard/harnesses/${harnessId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setEditHarnessConfig(data.config);
          setActiveTab("builder");
        } else {
          alert("Không thể tải sơ đồ chi tiết: " + data.error);
        }
      })
      .catch((err) => alert("Lỗi kết nối tới máy chủ: " + err.message));
  };

  const handleDeleteHarness = (harnessId: string, displayName: string) => {
    if (!confirm(`⚠️ Bạn có chắc chắn muốn xóa vĩnh viễn quy trình sơ đồ '${displayName}'? Thao tác này không thể hoàn tác.`)) return;

    fetch(`/api/dashboard/harnesses/${harnessId}`, { method: "DELETE" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert(data.message);
          setReloadTrigger((prev) => prev + 1);
        } else {
          alert("Gặp sự cố khi xóa sơ đồ: " + data.error);
        }
      })
      .catch((err) => alert("Lỗi kết nối tới máy chủ: " + err.message));
  };

  const handleViewDiffByPath = (filePath: string) => {
    if (!filePath) return;
    const cleanInputPath = filePath.replace(/\\/g, '/').toLowerCase();

    const foundInShadow = shadowChanges.find(c => {
      const cleanAbs = c.absolute_path.replace(/\\/g, '/').toLowerCase();
      return cleanAbs === cleanInputPath || cleanAbs.endsWith(cleanInputPath) || cleanInputPath.endsWith(cleanAbs);
    });

    if (foundInShadow) {
      setDiffMode('latest');
      setSelectedDiff(foundInShadow);
    } else {
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

  const isDark = theme === "dark";

  return (
    <div className={`min-h-screen flex flex-col font-sans antialiased overflow-hidden h-screen select-none transition-colors duration-200 ${isDark ? "bg-zinc-950 text-zinc-100 dark" : "bg-white text-zinc-800"
      }`}>
      {!isServerConnected && (
        <div className="bg-red-600 text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 z-[9999] shadow-md shrink-0">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>⚠️ Mất kết nối tới Bridge Server. Hệ thống đang tự động kết nối lại...</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden h-full">
        {/* SIDEBAR TRÁI */}
        <aside className={`w-60 border-r flex flex-col justify-between shrink-0 h-full overflow-y-auto transition-colors duration-200 ${isDark
          ? "bg-zinc-900 border-zinc-800 text-zinc-300"
          : "bg-zinc-50 border-zinc-200 text-zinc-700"
          }`}>
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-2 px-1">
              <span className="text-blue-600 font-bold text-lg animate-pulse">⚡</span>
              <div>
                <h1 className={`text-xs font-bold tracking-wide uppercase ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>Bridge Server</h1>
                <p className="text-[9px] text-zinc-400 font-medium">Intelligence Layer</p>
              </div>
            </div>

            <button
              onClick={() => {
                setEditHarnessConfig(null);
                setActiveTab("flow");
              }}
              className={`flex items-center justify-center gap-2 w-full border text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer ${isDark
                ? "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-100"
                }`}
            >
              <span className="text-sm font-bold">+</span> Trò chuyện mới
            </button>

            <nav className="space-y-1">
              {[
                { tab: "flow" as TabPanel, label: "Visual Flow", icon: "🌐" },
                { tab: "builder" as TabPanel, label: "Graph Builder", icon: "📐" },
                { tab: "traces" as TabPanel, label: "Search Traces", icon: "🔍" },
                { tab: "telemetry" as TabPanel, label: "Skills Telemetry", icon: "📊" },
                { tab: "memory" as TabPanel, label: "FluxMem Assets", icon: "🧠" },
                { tab: "sandbox" as TabPanel, label: "Shadow Files", icon: "🛡️" },
                { tab: "telegram" as TabPanel, label: "Connect Mobile", icon: "✈️" }
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    if (item.tab !== "builder") setEditHarnessConfig(null);
                    setActiveTab(item.tab);
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === item.tab
                    ? (isDark ? "bg-zinc-800 text-white font-semibold" : "bg-zinc-200/80 text-zinc-900 font-semibold")
                    : (isDark ? "text-zinc-400 hover:bg-zinc-800/40 hover:text-white" : "text-zinc-655 hover:bg-zinc-200/40 hover:text-zinc-900")
                    }`}
                >
                  <span className="text-sm">{item.icon}</span> {item.label}
                </button>
              ))}
            </nav>

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Current Goal</span>
              <div className={`px-3 py-2 border rounded-xl space-y-2 transition-colors ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
                }`}>
                <p className={`text-[11px] leading-normal line-clamp-3 select-text font-medium ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                  {goal || "Chưa thiết lập mục tiêu hiện tại."}
                </p>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={handleEditGoal} className="text-[9px] text-blue-500 hover:underline font-bold cursor-pointer border-none bg-transparent">
                    Sửa
                  </button>
                  {goal && (
                    <button onClick={handleClearGoal} className="text-[9px] text-red-500 hover:underline font-bold cursor-pointer border-none bg-transparent">
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>

            <SidebarHarnessList
              harnesses={harnesses}
              onRun={handleActivateHarness}
              onEdit={handleEditHarness}
              onDelete={handleDeleteHarness}
            />

            <SidebarShadowChanges
              shadowChanges={shadowChanges}
              onViewDiff={(change) => setSelectedDiff(change)}
              onRollback={handleRollback}
            />
          </div>

          <div className={`p-4 border-t flex items-center justify-between select-none shrink-0 transition-colors ${isDark ? "border-zinc-800 bg-zinc-950/20" : "border-zinc-200 bg-zinc-100/30"
            }`}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-500 flex items-center justify-center font-bold text-xs border border-blue-500/10">
                XL
              </div>
              <div className="text-left">
                <p className={`text-xs font-bold leading-none ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>Xơn Lê</p>
                <p className="text-[10px] text-zinc-400 font-medium mt-1">Administrator</p>
              </div>
            </div>
            <button title="Download logs" className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-1 border-none bg-transparent">
              📥
            </button>
          </div>
        </aside>

        {/* WORKSPACE CHÍNH */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden h-full relative">
          {activeTab === "flow" ? (
            <VisualFlow
              activeAgent={activeAgent}
              activeModel={activeModel}
              setActiveModel={setActiveModel}
              sse={sse}
              workspaceData={workspaceData}
              onViewDiff={handleViewDiffByPath}
              theme={theme}
              setTheme={setTheme}
            />
          ) : activeTab === "builder" ? (
            <div className={`flex-1 flex flex-col overflow-hidden h-full border-l transition-colors duration-200 ${isDark ? "bg-[#05050c] text-zinc-200 border-zinc-800" : "bg-white text-zinc-800 border-zinc-200"
              }`}>
              <header className={`px-6 py-4 border-b flex justify-between items-center select-none shrink-0 transition-colors duration-200 ${isDark ? "bg-zinc-900/60 border-zinc-850" : "bg-zinc-50 border-zinc-200"
                }`}>
                <div>
                  <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                    <span>📐</span> Graph Builder
                  </h2>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">Thiết kế, biên tập, kết nối dây và Deploy nóng Agent không cần viết code</p>
                </div>
                <button
                  onClick={() => setActiveTab("flow")}
                  className="text-xs text-blue-600 hover:underline cursor-pointer border-none bg-transparent font-semibold font-sans"
                >
                  ← Trở lại sơ đồ chạy Live
                </button>
              </header>

              <div className="flex-1 overflow-hidden p-6 h-full w-full">
                {/* ĐỒNG BỘ: Truyền biến theme vào GraphBuilder */}
                <GraphBuilder
                  onSaveSuccess={() => setReloadTrigger((prev) => prev + 1)}
                  editConfig={editHarnessConfig}
                  theme={theme}
                />
              </div>
            </div>
          ) : activeTab === "traces" ? (
            <div className={`flex-1 flex flex-col overflow-hidden h-full border-l transition-colors duration-200 ${isDark ? "bg-[#05050c] text-zinc-200 border-zinc-800" : "bg-white text-zinc-800 border-zinc-200"
              }`}>
              <header className={`px-6 py-4 border-b flex justify-between items-center select-none shrink-0 transition-colors duration-200 ${isDark ? "bg-zinc-900/60 border-zinc-850" : "bg-zinc-50 border-zinc-200"
                }`}>
                <div>
                  <h2 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>
                    <span>🔍</span> Trace Viewer
                  </h2>
                  <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">Workspace điều khiển & Phân tích tối ưu hệ thống Agent</p>
                </div>
                <button
                  onClick={() => setActiveTab("flow")}
                  className="text-xs text-blue-600 hover:underline cursor-pointer border-none bg-transparent font-semibold font-sans"
                >
                  ← Trở lại sơ đồ chạy Live
                </button>
              </header>

              <div className="flex-1 overflow-hidden p-6 h-full w-full">
                <TraceViewer reloadTrigger={reloadTrigger} onViewDiff={handleViewDiffByPath} theme={theme} />
              </div>
            </div>
          ) : (
            <div className={`flex-1 p-8 overflow-y-auto select-text border-l transition-colors duration-200 ${isDark ? "bg-[#05050c] text-zinc-250 border-zinc-800" : "bg-white text-zinc-800 border-zinc-200"
              }`}>
              <div className="max-w-6xl mx-auto space-y-6">
                <div className={`flex justify-between items-center border-b pb-4 mb-4 select-none ${isDark ? "border-zinc-850" : "border-zinc-200"
                  }`}>
                  <div>
                    <h2 className={`text-lg font-bold uppercase tracking-wider flex items-center gap-2 ${isDark ? "text-white" : "text-zinc-800"}`}>
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
                    onClick={() => setActiveTab("flow")}
                    className="text-xs text-blue-600 hover:underline cursor-pointer border-none bg-transparent font-semibold font-sans"
                  >
                    ← Trở lại sơ đồ chạy Live
                  </button>
                </div>

                {activeTab === "telemetry" && <Telemetry reloadTrigger={reloadTrigger} theme={theme} />}
                {activeTab === "memory" && <MemoryGrid reloadTrigger={reloadTrigger} theme={theme} />}
                {activeTab === "sandbox" && <SandboxManager reloadTrigger={reloadTrigger} theme={theme} />}
                {activeTab === "telegram" && <TelegramConfig theme={theme} />}
              </div>
            </div>
          )}
        </main>
      </div>

      {selectedDiff && (
        <DiffLightbox
          selectedDiff={selectedDiff}
          diffMode={diffMode}
          onClose={() => setSelectedDiff(null)}
          onChangeDiffMode={(mode) => setDiffMode(mode)}
          highlightCodeLine={highlightCodeLine}
        />
      )}

      {runningHarnessId && (
        <HarnessRunModal
          harnessId={runningHarnessId}
          harnessName={harnesses.find(h => h.id === runningHarnessId)?.harness_name || ""}
          triggering={triggering}
          onSubmit={handleTriggerHarnessRun}
          onClose={() => setRunningHarnessId(null)}
        />
      )}
    </div>
  );
}