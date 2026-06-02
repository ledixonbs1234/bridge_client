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

interface TraceViewerProps {
  reloadTrigger: number;
}

export function TraceViewer({ reloadTrigger }: TraceViewerProps) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<{ trace: Trace; spans: Span[] } | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  useEffect(() => {
    loadTraces();
  }, [reloadTrigger]);

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

  const renderSpanNode = (span: Span, depth = 0) => {
    const isSelected = selectedSpan?.id === span.id;
    const typeIcon = span.type === "agent" ? "🤖" : span.type === "llm" ? "🧠" : span.type === "tool" ? "⚙️" : "📦";

    return (
      <div key={span.id} className="space-y-1">
        <div
          onClick={() => setSelectedSpan(span)}
          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-blue-50 border-l-4 border-blue-600 pl-1 text-blue-700" : "hover:bg-zinc-100"
            }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          <span className="mr-2 text-sm">{typeIcon}</span>
          <span className="text-xs text-zinc-700 font-mono truncate flex-1">{span.name}</span>
          <span className="text-[10px] text-zinc-400 font-mono ml-2">
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
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] border border-zinc-200 rounded-2xl h-[720px] max-h-[80vh] overflow-hidden bg-white select-text text-zinc-800">
      <div className="border-r border-zinc-200 overflow-y-auto flex flex-col bg-zinc-50/50">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">All Traces</span>
          <button onClick={loadTraces} className="text-xs text-blue-600 hover:underline cursor-pointer">
            Làm mới
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {traces.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTraceClick(t.id)}
              className={`p-3 cursor-pointer transition-colors text-left ${selectedTraceId === t.id ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`w-2 h-2 rounded-full ${t.status === "completed"
                    ? "bg-emerald-500 glow-emerald"
                    : t.status === "failed"
                      ? "bg-red-500"
                      : "bg-blue-500 animate-pulse"
                    }`}
                />
                <span className="text-xs font-bold text-zinc-800 truncate flex-1">{t.name}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>{t.span_count} spans</span>
                <span>{t.total_duration_ms ? `${(t.total_duration_ms / 1000).toFixed(1)}s` : "running..."}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {traceDetail ? (
          <>
            <div className="border-r border-zinc-200 overflow-y-auto p-4 space-y-2 text-left bg-zinc-50/30">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Span Hierarchy</h3>
              {traceDetail.spans
                .filter((s) => !s.parent_span_id)
                .map((rootSpan) => renderSpanNode(rootSpan))}
            </div>

            <div className="overflow-y-auto p-5 space-y-4 text-left bg-white">
              {selectedSpan ? (
                <>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900 mb-1">{selectedSpan.name}</h4>
                    <div className="flex gap-2">
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                        {selectedSpan.type}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${selectedSpan.status === "completed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-red-55 text-red-700 border border-red-200"
                          }`}
                      >
                        {selectedSpan.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 text-zinc-500 border-t border-zinc-100 pt-3">
                    <div className="flex">
                      <span className="w-24">ID:</span>
                      <span className="font-mono text-zinc-800">{selectedSpan.id}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24">Bắt đầu:</span>
                      <span>{new Date(selectedSpan.started_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex">
                      <span className="w-24">Thời gian:</span>
                      <span>{selectedSpan.duration_ms}ms</span>
                    </div>
                  </div>

                  {selectedSpan.input && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-zinc-500">Input Data:</div>
                      <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-blue-700 overflow-x-auto max-h-48 whitespace-pre-wrap select-text">
                        {selectedSpan.input}
                      </pre>
                    </div>
                  )}

                  {selectedSpan.output && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-zinc-500">Output Data:</div>
                      <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-emerald-850 overflow-x-auto max-h-60 whitespace-pre-wrap select-text">
                        {selectedSpan.output}
                      </pre>
                    </div>
                  )}

                  {selectedSpan.error && (
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-red-600">Error Stack:</div>
                      <pre className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-mono text-red-700 overflow-x-auto whitespace-pre-wrap select-text">
                        {selectedSpan.error}
                      </pre>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-zinc-400 text-sm text-center py-20">Chọn một span để xem chi tiết</div>
              )}
            </div>
          </>
        ) : (
          <div className="col-span-2 flex items-center justify-center text-zinc-400 text-sm py-40 bg-zinc-50/10">
            Chọn một trace ở cột trái để duyệt sơ đồ spans
          </div>
        )}
      </div>
    </div>
  );
}