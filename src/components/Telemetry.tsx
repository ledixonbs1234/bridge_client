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

export function Telemetry() {
  const [report, setReport] = useState<TelemetryReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/telemetry")
      .then((res) => res.json())
      .then((data) => {
        setReport(data.report || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-400 text-sm">Đang tải dữ liệu telemetry...</div>;

  const totalCalls = report.reduce((sum, r) => sum + r.total, 0);
  const totalSuccess = report.reduce((sum, r) => sum + r.success, 0);
  const overallReliability = totalCalls > 0 ? Math.round((totalSuccess / totalCalls) * 100) : 100;
  const uniqueTools = report.length;

  return (
    <div className="space-y-6">
      {/* KHỐI THỐNG KÊ NHANH */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl shadow-sm">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Tổng lượt gọi Tool</h3>
          <SlidingNumber value={totalCalls} />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl shadow-sm">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Tỉ lệ thành công</h3>
          <div className="text-3xl font-bold text-emerald-400">{overallReliability}%</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl shadow-sm">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Số lượng Tools đã dùng</h3>
          <SlidingNumber value={uniqueTools} />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl shadow-sm">
          <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Thời gian chạy trung bình</h3>
          <div className="text-3xl font-bold text-amber-400">
            {report.length > 0 ? Math.round(report.reduce((s, r) => s + r.avgDuration, 0) / report.length) : 0}ms
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ HOẠT HỌA TAILWIND */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">Độ tin cậy của từng Tool (%)</h3>
          <div className="space-y-4">
            {report.map((r, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span className="font-mono">{r.tool}</span>
                  <span>{Math.round(r.reliability * 100)}%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${
                      r.reliability >= 0.9 ? "bg-emerald-500" : r.reliability >= 0.7 ? "bg-amber-500" : "bg-red-500"
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

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl">
          <h3 className="text-sm font-bold text-zinc-300 mb-4">Thời gian thực thi trung bình (ms)</h3>
          <div className="space-y-4">
            {report.map((r, idx) => {
              const maxDuration = Math.max(...report.map((item) => item.avgDuration), 1);
              const pct = (r.avgDuration / maxDuration) * 100;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span className="font-mono">{r.tool}</span>
                    <span>{r.avgDuration}ms</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
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