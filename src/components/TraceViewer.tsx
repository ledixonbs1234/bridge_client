import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Trace {
  id: string;
  name: string;
  span_count: number;
  total_duration_ms: number | null;
  status: "completed" | "failed" | "running";
  created_at: string;
}

interface Span {
  id: string;
  parent_span_id: string | null;
  name: string;
  type: "agent" | "tool" | "llm" | "function";
  status: "completed" | "failed" | "running";
  started_at: string;
  completed_at: string;
  duration_ms: number;
  input?: string;
  output?: string;
  error?: string;
}

export function TraceViewer() {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<{ trace: Trace; spans: Span[] } | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  useEffect(() => {
    loadTraces();
  }, []);

  const loadTraces = () => {
    fetch("/api/dashboard/traces")
      .then((res) => res.json())
      .then((data) => setTraces(data.traces || []));
  };

  const handleTraceClick = (traceId: string) => {
    setSelectedTraceId(traceId);
    setTraceDetail(null);
    setSelectedSpan(null);
    fetch(`/api/dashboard/traces/${traceId}`)
      .then((res) => res.json())
      .then((data) => {
        setTraceDetail(data);
        if (data.spans && data.spans.length > 0) {
          setSelectedSpan(data.spans[0]);
        }
      });
  };

  // Hàm phụ trợ dựng cây đệ quy Span Tree
  const renderSpanNode = (span: Span, depth = 0) => {
    const isSelected = selectedSpan?.id === span.id;
    const typeIcon = span.type === "agent" ? "🤖" : span.type === "llm" ? "🧠" : span.type === "tool" ? "⚙️" : "📦";

    return (
      <div key={span.id} className="space-y-1">
        <div
          onClick={() => setSelectedSpan(span)}
          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
            isSelected ? "bg-blue-600/10 border-l-4 border-blue-500 pl-1" : "hover:bg-zinc-800/40"
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span className="mr-2 text-sm">{typeIcon}</span>
          <span className="text-xs text-zinc-200 font-mono truncate flex-1">{span.name}</span>
          <span className="text-[10px] text-zinc-500 font-mono ml-2">
            {span.duration_ms ? `${span.duration_ms}ms` : "..."}
          </span>
        </div>
        {traceDetail?.spans
          .filter((s) => s.parent_span_id === span.id)
          .map((child) => renderSpanNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] border border-zinc-800 rounded-2xl h-[720px] max-h-[80vh] overflow-hidden bg-zinc-900/50">
      {/* CỘT TRÁI: DANH SÁCH TRACES */}
      <div className="border-r border-zinc-800 overflow-y-auto flex flex-col bg-zinc-950/20">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">All Traces</span>
          <button
            onClick={loadTraces}
            className="text-xs text-blue-400 hover:underline"
          >
            Làm mới
          </button>
        </div>
        <div className="divide-y divide-zinc-800/50">
          {traces.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTraceClick(t.id)}
              className={`p-3 cursor-pointer transition-colors text-left ${
                selectedTraceId === t.id ? "bg-zinc-800/50" : "hover:bg-zinc-800/20"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    t.status === "completed" ? "bg-emerald-500" : t.status === "failed" ? "bg-red-500" : "bg-blue-500 animate-pulse"
                  }`}
                />
                <span className="text-xs font-bold text-zinc-200 truncate flex-1">{t.name}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                <span>{t.span_count} spans</span>
                <span>{t.total_duration_ms ? `${(t.total_duration_ms / 1000).toFixed(1)}s` : "running..."}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CỘT PHẢI: CHI TIẾT TRACE & SPAN TREE */}
      <div className="grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {traceDetail ? (
          <>
            {/* CÂY PHÂN CẤP SPANS */}
            <div className="border-r border-zinc-800/60 overflow-y-auto p-4 space-y-2 text-left bg-zinc-950/10">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Span Hierarchy</h3>
              {traceDetail.spans
                .filter((s) => !s.parent_span_id)
                .map((rootSpan) => renderSpanNode(rootSpan))}
            </div>

            {/* CHI TIẾT CỦA SPAN ĐANG CHỌN */}
            <div className="overflow-y-auto p-5 space-y-4 text-left bg-zinc-900">
              {selectedSpan ? (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-100 mb-1">{selectedSpan.name}</h4>
                    <div className="flex gap-2">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {selectedSpan.type}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                          selectedSpan.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {selectedSpan.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 text-zinc-400 border-t border-zinc-800/50 pt-3">
                    <div className="flex"><span className="w-24">ID:</span><span className="font-mono text-zinc-300">{selectedSpan.id}</span></div>
                    <div className="flex"><span className="w-24">Bắt đầu:</span><span>{new Date(selectedSpan.started_at).toLocaleTimeString()}</span></div>
                    <div className="flex"><span className="w-24">Thời gian:</span><span>{selectedSpan.duration_ms}ms</span></div>
                  </div>

                  {selectedSpan.input && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-zinc-400">Input Data:</div>
                      <pre className="p-3 bg-zinc-950 rounded-lg text-xs font-mono text-blue-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                        {selectedSpan.input}
                      </pre>
                    </div>
                  )}

                  {selectedSpan.output && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-zinc-400">Output Data:</div>
                      <pre className="p-3 bg-zinc-950 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-60 whitespace-pre-wrap">
                        {selectedSpan.output}
                      </pre>
                    </div>
                  )}

                  {selectedSpan.error && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-red-400">Error Stack:</div>
                      <pre className="p-3 bg-red-950/20 border border-red-900/40 rounded-lg text-xs font-mono text-red-300 overflow-x-auto whitespace-pre-wrap">
                        {selectedSpan.error}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-zinc-500 text-sm text-center py-20">Chọn một span để xem chi tiết</div>
              )}
            </div>
          </>
        ) : (
          <div className="col-span-2 flex items-center justify-center text-zinc-500 text-sm py-40">
            Chọn một trace ở cột trái để duyệt sơ đồ spans
          </div>
        )}
      </div>
    </div>
  );
}