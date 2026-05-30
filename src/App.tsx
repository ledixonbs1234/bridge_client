import { useState, useEffect } from "react";
import { motion, LayoutGroup } from "motion/react";
import { WebTerminal } from "./components/WebTerminal";
import { Telemetry } from "./components/Telemetry";
import { TraceViewer } from "./components/TraceViewer";
import { MemoryGrid } from "./components/MemoryGrid";

type TabPanel = "terminal" | "telemetry" | "traces" | "memory";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabPanel>("terminal");
  const [goal, setGoal] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/sessions")
      .then((res) => res.json())
      .then((data) => setGoal(data.currentGoal || null));
  }, []);

  const handleEditGoal = () => {
    const nextGoal = prompt("Nhập mục tiêu (Goal) mới cho Agent:", goal || "");
    if (nextGoal === null) return;
    fetch("/api/dashboard/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: nextGoal }),
    })
      .then((res) => res.json())
      .then((data) => setGoal(data.goal));
  };

  const handleClearGoal = () => {
    if (!confirm("Xóa mục tiêu hiện tại?")) return;
    fetch("/api/dashboard/goal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: null }),
    })
      .then((res) => res.json())
      .then(() => setGoal(null));
  };

  const tabs: { id: TabPanel; label: string; icon: string }[] = [
    { id: "terminal", label: "Web Terminal", icon: "💬" },
    { id: "telemetry", label: "Telemetry", icon: "📊" },
    { id: "traces", label: "Traces", icon: "🔍" },
    { id: "memory", label: "FluxMem Memory", icon: "🧠" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans antialiased">
      {/* HEADER BAR (SHADCN GLASS THEME) */}
      <header className="px-8 py-4 border-b border-zinc-800 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div>
          <h1 className="text-base font-bold text-zinc-50 flex items-center gap-2">
            <span>⚡</span> Bridge Server Dashboard
          </h1>
          <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Autonomous Agent Intelligence Layer</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-1 rounded-full">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
          Online
        </div>
      </header>

      {/* TARGET GOAL BAR (SHADCN ALERT STYLE) */}
      {goal && (
        <div className="mx-8 mt-5 p-3.5 bg-amber-500/5 border border-amber-500/20 rounded-lg flex justify-between items-center text-xs animate-fade-in">
          <div className="flex items-center gap-2 text-left">
            <span className="text-amber-500 font-bold tracking-wider">🎯 TARGET GOAL:</span>
            <span className="text-zinc-300 font-medium leading-relaxed">{goal}</span>
          </div>
          <div className="flex gap-3 text-[11px] font-bold shrink-0 ml-4">
            <button onClick={handleEditGoal} className="text-zinc-400 hover:text-amber-400 transition-colors">Sửa</button>
            <button onClick={handleClearGoal} className="text-zinc-500 hover:text-red-400 transition-colors">Xóa</button>
          </div>
        </div>
      )}

      {/* SHADCN TAB LIST STYLE */}
      <div className="px-8 mt-6 flex justify-start">
        <div className="flex bg-zinc-900/60 border border-zinc-800 p-1 rounded-lg gap-1">
          <LayoutGroup>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-1.5 text-xs font-semibold rounded-md tracking-wide transition-colors ${
                    isActive ? "text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-glow"
                      className="absolute inset-0 bg-zinc-800 rounded-md shadow-sm"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </LayoutGroup>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="flex-1 p-8 overflow-hidden max-w-7xl mx-auto w-full">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="h-full"
        >
          {activeTab === "terminal" && <WebTerminal />}
          {activeTab === "telemetry" && <Telemetry />}
          {activeTab === "traces" && <TraceViewer />}
          {activeTab === "memory" && <MemoryGrid />}
        </motion.div>
      </main>
    </div>
  );
}