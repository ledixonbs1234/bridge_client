import { useState, useEffect } from "react";
import { useSSE } from "./hooks/useSSE";
import { WebTerminal } from "./components/WebTerminal";
import { Telemetry } from "./components/Telemetry";
import { TraceViewer } from "./components/TraceViewer";
import { MemoryGrid } from "./components/MemoryGrid";
import { TelegramConfig } from "./components/TelegramConfig";
import { SandboxManager } from "./components/SandboxManager";

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

export default function App() {
  const [activeTab, setActiveTab] = useState<TabPanel>("terminal");
  const [goal, setGoal] = useState<string | null>(null);

  const [activeAgent, setActiveAgent] = useState<"MaxHermes" | "MaxClaw">("MaxHermes");
  const [activeModel, setActiveModel] = useState<string>("MiniMax-M3");
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Live real-time workspace state
  const [workspaceData, setWorkspaceData] = useState<WorkspaceData | null>(null);

  // State quản lý trạng thái kết nối của Bridge Server
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);

  const sse = useSSE(() => {
    setReloadTrigger((prev) => prev + 1);
    fetchWorkspace();
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
          setIsServerConnected(true); // Kết nối hoạt động tốt
          if (data.provider) {
            setActiveModel(data.provider.model);
          }
        }
      })
      .catch((err) => {
        console.error("Error reading active workspace state:", err);
        setIsServerConnected(false); // Đánh dấu mất kết nối để hiển thị cảnh báo
      });
  };

  useEffect(() => {
    fetch("/api/dashboard/sessions")
      .then((res) => res.json())
      .then((data) => setGoal(data.currentGoal || null))
      .catch(() => setIsServerConnected(false));

    fetchWorkspace();

    const interval = setInterval(fetchWorkspace, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleEditGoal = () => {
    const nextGoal = prompt("Nhập mụcêu (Goal) mới cho Agent:", goal || "");
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

      {/* THANH CẢNH BÁO MẤT KẾT NỐI VỚI BACKEND */}
      {!isServerConnected && (
        <div className="bg-red-600 text-white text-xs font-semibold text-center py-2 px-4 flex items-center justify-center gap-2 z-[9999] shadow-md shrink-0">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>⚠️ Mất kết nối tới Bridge Server. Hệ thống đang tự động kết nối lại...</span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden h-full">
        {/* PERSISTENT LIGHT SIDEBAR */}
        <aside className="w-60 bg-zinc-50 border-r border-zinc-200 flex flex-col justify-between shrink-0 h-full text-zinc-700">
          <div className="p-4 space-y-6">
            <div className="flex items-center gap-2 px-1">
              <span className="text-blue-600 font-bold text-lg animate-pulse">⚡</span>
              <div>
                <h1 className="text-xs font-bold text-zinc-900 tracking-wide uppercase">Bridge Server</h1>
                <p className="text-[9px] text-zinc-400 font-medium">Intelligence Layer</p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTab("terminal");
              }}
              className="flex items-center justify-center gap-2 w-full border border-zinc-200 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold py-2 px-3 rounded-lg transition-colors cursor-pointer"
            >
              <span className="text-sm font-bold">+</span> New task
            </button>

            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab("traces")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "traces" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                  }`}
              >
                <span className="text-sm">🔍</span> Search
              </button>
              <button
                onClick={() => setActiveTab("telemetry")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "telemetry" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                  }`}
              >
                <span className="text-sm">📊</span> Skills
              </button>
              <button
                onClick={() => setActiveTab("terminal")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "terminal" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                  }`}
              >
                <span className="text-sm">📅</span> Scheduled
              </button>
              <button
                onClick={() => setActiveTab("memory")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "memory" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                  }`}
              >
                <span className="text-sm">🧠</span> Assets
              </button>
              <button
                onClick={() => setActiveTab("sandbox")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "sandbox" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                  }`}
              >
                <span className="text-sm">📦</span> Sandbox
              </button>
              <button
                onClick={() => setActiveTab("telegram")}
                className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${activeTab === "telegram" ? "bg-zinc-200/80 text-zinc-900 font-semibold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                  }`}
              >
                <span className="text-sm">✈️</span> Connect Mobile
              </button>
            </nav>

            {/* MORE SECTION */}
            <div className="space-y-1.5">
              <span className="px-3 text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">More</span>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    setActiveAgent("MaxHermes");
                    setActiveTab("terminal");
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${activeAgent === "MaxHermes" && activeTab === "terminal" ? "bg-zinc-200/80 text-zinc-900 font-bold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#5046e5]" />
                  <span>MaxHermes</span>
                </button>
                <button
                  onClick={() => {
                    setActiveAgent("MaxClaw");
                    setActiveTab("terminal");
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs text-left rounded-lg transition-colors cursor-pointer ${activeAgent === "MaxClaw" && activeTab === "terminal" ? "bg-zinc-200/80 text-zinc-900 font-bold" : "text-zinc-650 hover:bg-zinc-200/40 hover:text-zinc-900"
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#8b5cf6]" />
                  <span>MaxClaw</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="px-3 text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">Current Goal</span>
              <div className="px-3 py-2 bg-white border border-zinc-200 rounded-xl space-y-2">
                <p className="text-[11px] text-zinc-700 leading-normal line-clamp-3 select-text font-medium">
                  {goal || "Chưa thiết lập mục tiêu hiện tại."}
                </p>
                <div className="flex gap-1.5 pt-1">
                  <button onClick={handleEditGoal} className="text-[9px] text-blue-600 hover:text-blue-500 font-bold cursor-pointer">
                    Sửa
                  </button>
                  {goal && (
                    <button onClick={handleClearGoal} className="text-[9px] text-red-600 hover:text-red-500 font-bold cursor-pointer">
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-zinc-200 flex items-center justify-between select-none bg-zinc-100/30">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold text-xs border border-blue-500/10">
                XL
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-zinc-800 leading-none">Xơn Lê</p>
                <p className="text-[10px] text-zinc-400 font-medium mt-1">Administrator</p>
              </div>
            </div>
            <button title="Download logs" className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-1">
              📥
            </button>
          </div>
        </aside>

        {/* MAIN CONTAINER WORKSPACE */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden h-full relative">
          {activeTab === "terminal" ? (
            <WebTerminal
              activeAgent={activeAgent}
              activeModel={activeModel}
              setActiveModel={setActiveModel}
              sse={sse}
              workspaceData={workspaceData}
            />
          ) : (
            <div className="flex-1 bg-white text-zinc-800 p-8 overflow-y-auto select-text border-l border-zinc-200">
              <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-200 pb-4 mb-4 select-none">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
                      <span>⚡</span>{" "}
                      {activeTab === "telemetry"
                        ? "Telemetry Report"
                        : activeTab === "traces"
                          ? "Trace Viewer"
                          : activeTab === "memory"
                            ? "FluxMem Layer"
                            : activeTab === "sandbox"
                              ? "Git Sandbox Controller"
                              : "Telegram Config"}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-1">Workspace điều khiển & Phân tích tối ưu hệ thống Agent</p>
                  </div>
                  <button
                    onClick={() => setActiveTab("terminal")}
                    className="text-xs text-blue-600 hover:underline cursor-pointer"
                  >
                    ← Trở lại khung Chat
                  </button>
                </div>

                {activeTab === "telemetry" && <Telemetry reloadTrigger={reloadTrigger} />}
                {activeTab === "traces" && <TraceViewer reloadTrigger={reloadTrigger} />}
                {activeTab === "memory" && <MemoryGrid reloadTrigger={reloadTrigger} />}
                {activeTab === "sandbox" && <SandboxManager reloadTrigger={reloadTrigger} />}
                {activeTab === "telegram" && <TelegramConfig />}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}