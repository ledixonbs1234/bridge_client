// filepath: ridge_client/src/components/Telemetry.tsx
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { SlidingNumber } from "./animate-ui/sliding-number";

interface TelemetryReport {
  tool: string;
  total: number;
  success: number;
  fail: number;
  reliability: number;
  avgDuration: number;
}

interface TelemetryProps {
  reloadTrigger: number;
  theme?: "light" | "dark";
}

export function Telemetry({ reloadTrigger, theme = "light" }: TelemetryProps) {
  const [report, setReport] = useState<TelemetryReport[]>([]);
  const [loading, setLoading] = useState(true);

  const isDark = theme === "dark";

  useEffect(() => {
    fetch("/api/dashboard/telemetry")
      .then((res) => res.json())
      .then((data) => {
        setReport(data.report || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [reloadTrigger]);

  if (loading) return <div className="text-zinc-500 text-sm">Đang tải dữ liệu telemetry...</div>;

  const totalCalls = report.reduce((sum, r) => sum + r.total, 0);
  const totalSuccess = report.reduce((sum, r) => sum + r.success, 0);
  const overallReliability = totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 100;
  const uniqueTools = report.length;

  return (
    <div className={`space-y-6 text-left transition-colors duration-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>

      {/* 4 THẺ METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2 font-bold">Tổng lượt gọi Tool</h3>
          <SlidingNumber value={totalCalls} />
        </div>
        <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2 font-bold">Tỉ lệ thành công</h3>
          <div className="text-3xl font-bold text-emerald-500">{overallReliability}%</div>
        </div>
        <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2 font-bold">Số lượng Tools đã dùng</h3>
          <SlidingNumber value={uniqueTools} />
        </div>
        <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2 font-bold">Thời gian chạy trung bình</h3>
          <div className="text-3xl font-bold text-amber-500">
            {report.length > 0 ? Math.round(report.reduce((s, r) => s + r.avgDuration, 0) / report.length) : 0}ms
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* THANH ĐO TIN CẬY */}
        <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <h3 className={`text-sm font-bold mb-4 ${isDark ? "text-zinc-250" : "text-zinc-700"}`}>Độ tin cậy của từng Tool (%)</h3>
          <div className="space-y-4">
            {report.map((r, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="font-mono text-zinc-400">{r.tool}</span>
                  <span className={isDark ? "text-zinc-100" : "text-zinc-800"}>{Math.round(r.reliability * 100)}%</span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-zinc-950" : "bg-zinc-200"}`}>
                  <motion.div
                    className={`h-full rounded-full ${r.reliability >= 0.9 ? "bg-emerald-500" : r.reliability >= 0.7 ? "bg-amber-500" : "bg-red-500"
                      }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.reliability * 100}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* THỜI GIAN THỰC THI TRUNG BÌNH */}
        <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"
          }`}>
          <h3 className={`text-sm font-bold mb-4 ${isDark ? "text-zinc-250" : "text-zinc-700"}`}>Thời gian thực thi trung bình (ms)</h3>
          <div className="space-y-4">
            {report.map((r, idx) => {
              const maxDuration = Math.max(...report.map((item) => item.avgDuration), 1);
              const pct = (r.avgDuration / maxDuration) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="font-mono text-zinc-400">{r.tool}</span>
                    <span className={isDark ? "text-zinc-100" : "text-zinc-800"}>{r.avgDuration}ms</span>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-zinc-950" : "bg-zinc-200"}`}>
                    <motion.div
                      className="h-full bg-blue-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.05 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}