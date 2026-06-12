import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface Trace {
  id: string;
  name: string;
  span_count: number;
  total_duration_ms: number | null;
  status: "completed" | "failed" | "running";
  created_at: string;
  output?: string;
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
  onViewDiff?: (filePath: string) => void;
  theme?: "light" | "dark";
}

const safeDecodeBase64 = (str: string) => {
  try {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    try {
      return atob(str);
    } catch {
      return str;
    }
  }
};

export function TraceViewer({ reloadTrigger, onViewDiff, theme = "light" }: TraceViewerProps) {
  const [traces, setTraces] = useState<Trace[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [traceDetail, setTraceDetail] = useState<{ trace: Trace; spans: Span[] } | null>(null);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);

  const isDark = theme === "dark";

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
          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isSelected
            ? (isDark ? "bg-zinc-800/80 border-l-4 border-blue-500 pl-1 text-blue-400 font-bold" : "bg-blue-50 border-l-4 border-blue-600 pl-1 text-blue-700 font-bold")
            : (isDark ? "hover:bg-zinc-800 text-zinc-300" : "hover:bg-zinc-100 text-zinc-700")
            }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          <span className="mr-2 text-sm">{typeIcon}</span>
          <span className="text-xs font-mono truncate flex-1">{span.name}</span>
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

  const renderSpanInputDetails = (span: Span) => {
    if (!span.input) return null;
    try {
      const parsed = JSON.parse(span.input);

      if (span.name === 'replace_content_safe') {
        return (
          <div className={`space-y-3 p-4 border rounded-xl text-xs transition-colors duration-200 ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-800"
            }`}>
            <div className="font-bold text-blue-550 text-[11px] uppercase tracking-wider flex items-center gap-1.5 select-none">
              📝 CHI TIẾT SỬA ĐỔI FILE (REPLACE CONTENT SAFE)
            </div>
            <div className="space-y-1.5 leading-relaxed">
              <div>
                • <b>Tệp tin bị sửa đổi:</b>{" "}
                <button
                  type="button"
                  onClick={() => onViewDiff && onViewDiff(parsed.file_path)}
                  className={`px-1.5 py-0.5 rounded font-mono hover:underline border-none cursor-pointer text-xs font-semibold text-left break-all select-text ${isDark ? "bg-zinc-900 text-blue-400 hover:bg-zinc-800" : "bg-zinc-100 text-blue-700 hover:bg-blue-50"
                    }`}
                >
                  📄 {parsed.file_path} (Bấm để xem thay đổi 🔍)
                </button>
              </div>
              <div>• <b>Khoảng dòng sửa:</b> <span className={`font-semibold ${isDark ? "text-zinc-100" : "text-zinc-700"}`}>Dòng {parsed.start_line} đến dòng {parsed.end_line}</span></div>
              {parsed.task_description && <div>• <b>Mô tả công việc:</b> <span className={`italic font-sans font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{parsed.task_description}</span></div>}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="font-semibold text-rose-500 select-none">❌ Đoạn mã cũ bị xóa (Target Content):</div>
                <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-40 whitespace-pre select-text leading-normal transition-colors ${isDark ? "bg-red-950/25 border-red-900/40 text-rose-300" : "bg-rose-50 border-rose-150 text-rose-800"
                  }`}>
                  {parsed.target_content}
                </pre>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-emerald-500 select-none">✅ Đoạn mã mới được đưa vào (Replacement Content):</div>
                <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-48 whitespace-pre select-text leading-normal transition-colors ${isDark ? "bg-emerald-950/25 border-emerald-900/40 text-emerald-300" : "bg-emerald-50 border-emerald-150 text-emerald-850"
                  }`}>
                  {parsed.replacement_content}
                </pre>
              </div>
            </div>
          </div>
        );
      }

      if (span.name === 'replace_multiple_files_safe') {
        const edits = parsed.edits || [];
        return (
          <div className={`space-y-3 p-4 border rounded-xl text-xs transition-colors duration-200 ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-800"
            }`}>
            <div className="font-bold text-indigo-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5 select-none">
              📝 CHI TIẾT SỬA ĐỔI HÀNG LOẠT (REPLACE MULTIPLE FILES)
            </div>
            {parsed.task_description && (
              <div className="leading-relaxed">• <b>Mô tả tác vụ:</b> <span className={`italic font-sans font-medium ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{parsed.task_description}</span></div>
            )}
            <div className="space-y-4 divide-y divide-zinc-200">
              {edits.map((edit: any, eIdx: number) => (
                <div key={eIdx} className={`${eIdx > 0 ? 'pt-4' : ''} space-y-2`}>
                  <div className="space-y-1">
                    <div>
                      • <b>Tệp #{eIdx + 1}:</b>{" "}
                      <button
                        type="button"
                        onClick={() => onViewDiff && onViewDiff(edit.file_path)}
                        className={`px-1.5 py-0.5 rounded font-mono hover:underline border-none cursor-pointer text-xs font-semibold text-left break-all select-text ${isDark ? "bg-zinc-900 text-indigo-400 hover:bg-zinc-800" : "bg-zinc-100 text-indigo-700 hover:bg-indigo-50"
                          }`}
                      >
                        📄 {edit.file_path} (Bấm để xem thay đổi 🔍)
                      </button>
                    </div>
                    <div>• <b>Vị trí sửa:</b> <span className={`font-semibold ${isDark ? "text-zinc-100" : "text-zinc-700"}`}>Dòng {edit.start_line} → {edit.end_line}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="font-semibold text-rose-500 text-[10px] select-none">❌ Đoạn mã cũ bị xóa:</div>
                      <pre className={`p-2.5 border rounded text-xs font-mono overflow-x-auto max-h-24 whitespace-pre select-text leading-normal transition-colors ${isDark ? "bg-red-950/25 border-red-900/40 text-rose-350" : "bg-rose-50 border-rose-100 text-rose-800"
                        }`}>
                        {edit.target_content}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-emerald-500 text-[10px] select-none">✅ Đoạn mã mới thay thế:</div>
                      <pre className={`p-2.5 border rounded text-xs font-mono overflow-x-auto max-h-32 whitespace-pre select-text leading-normal transition-colors ${isDark ? "bg-emerald-950/25 border-emerald-900/40 text-emerald-350" : "bg-emerald-50 border-emerald-100 text-emerald-850"
                        }`}>
                        {edit.replacement_content}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }

      if (span.name === 'write_file') {
        const content = parsed.content_base64
          ? safeDecodeBase64(parsed.content_base64)
          : parsed.content;
        return (
          <div className={`space-y-3 p-4 border rounded-xl text-xs transition-colors duration-200 ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-800"
            }`}>
            <div className="font-bold text-teal-500 text-[11px] uppercase tracking-wider flex items-center gap-1.5 select-none">
              💾 CHI TIẾT GHI ĐÈ / TẠO MỚI (WRITE FILE)
            </div>
            <div className="space-y-1 leading-relaxed">
              <div>• <b>Đường dẫn tệp tin:</b> <code className={`px-1.5 py-0.5 rounded font-mono select-text break-all ${isDark ? "bg-zinc-900 text-teal-400" : "bg-zinc-100 text-teal-700"}`}>{parsed.file_path}</code></div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-teal-500 select-none">📝 Nội dung ghi:</div>
              <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-48 whitespace-pre select-text leading-normal transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-850"
                }`}>
                {content}
              </pre>
            </div>
          </div>
        );
      }
    } catch (e) { }

    return (
      <div className="space-y-1">
        <div className="text-xs font-bold text-zinc-500 select-none">Input Data:</div>
        <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-48 whitespace-pre-wrap select-text leading-relaxed transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-blue-400" : "bg-zinc-50 border-zinc-200 text-blue-700"
          }`}>
          {span.input}
        </pre>
      </div>
    );
  };

  const renderSpanOutputDetails = (span: Span) => {
    if (!span.output) return null;
    try {
      const parsed = JSON.parse(span.output);
      if (parsed && typeof parsed === 'object') {

        if (parsed.text && typeof parsed.text === 'string') {
          return (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
              <pre className={`p-3.5 border rounded-xl text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre select-text leading-normal transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}>
                {parsed.text}
              </pre>
            </div>
          );
        }

        if (parsed.response && typeof parsed.response === 'string') {
          return (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
              <div className={`p-4 border rounded-xl text-xs font-sans overflow-y-auto max-h-[500px] whitespace-pre-wrap select-text leading-relaxed transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}>
                {parsed.response}
              </div>
            </div>
          );
        }

        if (parsed.status === "success" && parsed.data) {
          const dataStr = typeof parsed.data === 'object' ? JSON.stringify(parsed.data, null, 2) : String(parsed.data);
          return (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
              <pre className={`p-3.5 border rounded-xl text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap select-text leading-normal transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-zinc-50 border-zinc-200 text-zinc-800"
                }`}>
                {dataStr}
              </pre>
            </div>
          );
        }

        return (
          <div className="space-y-1">
            <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
            <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-60 whitespace-pre-wrap select-text leading-relaxed transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-emerald-400" : "bg-zinc-50 border-zinc-200 text-emerald-850"
              }`}>
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      }
    } catch (e) { }

    return (
      <div className="space-y-1">
        <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
        <pre className={`p-3 border rounded-lg text-xs font-mono overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap select-text leading-relaxed transition-colors ${isDark ? "bg-zinc-900 border-zinc-800 text-emerald-400" : "bg-zinc-50 border-zinc-200 text-emerald-850"
          }`}>
          {span.output}
        </pre>
      </div>
    );
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-[260px_280px_1fr] border rounded-2xl h-full w-full overflow-hidden select-text transition-colors duration-200 ${isDark ? "bg-zinc-950 text-zinc-200 border-zinc-800" : "bg-white text-zinc-800 border-zinc-200 shadow-sm"
      }`}>

      {/* CỘT 1: DANH SÁCH TRACES */}
      <div className={`border-r overflow-y-auto flex flex-col select-none transition-colors ${isDark ? "bg-zinc-900/30 border-zinc-800" : "bg-zinc-50/50 border-zinc-200"
        }`}>
        <div className={`p-4 border-b flex justify-between items-center transition-colors ${isDark ? "bg-zinc-900 border-zinc-850" : "bg-white"
          }`}>
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">All Traces</span>
          <button onClick={loadTraces} className="text-xs text-blue-500 hover:underline cursor-pointer border-none bg-transparent font-bold">
            Làm mới 🔄
          </button>
        </div>
        <div className={`divide-y transition-colors ${isDark ? "divide-zinc-850" : "divide-zinc-100"}`}>
          {traces.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTraceClick(t.id)}
              className={`p-3 cursor-pointer transition-colors text-left ${selectedTraceId === t.id
                ? (isDark ? "bg-zinc-800/60" : "bg-zinc-200/50")
                : (isDark ? "hover:bg-zinc-850/40" : "hover:bg-zinc-100/40")
                }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${t.status === "completed"
                    ? "bg-emerald-500"
                    : t.status === "failed"
                      ? "bg-red-500"
                      : "bg-blue-500 animate-pulse"
                    }`}
                />
                <span className={`text-xs font-bold truncate flex-1 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{t.name}</span>
              </div>
              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>{t.span_count} spans</span>
                <span>{t.total_duration_ms ? `${(t.total_duration_ms / 1000).toFixed(1)}s` : "running..."}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {traceDetail ? (
        <>
          {/* CỘT 2: SƠ ĐỒ CÂY SPANS */}
          <div className={`border-r overflow-y-auto p-4 space-y-2 text-left select-none transition-colors ${isDark ? "bg-zinc-950/20 border-zinc-800" : "bg-zinc-50/30 border-zinc-200"
            }`}>
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Span Hierarchy</h3>
            {traceDetail.spans
              .filter((s) => !s.parent_span_id)
              .map((rootSpan) => renderSpanNode(rootSpan))}
          </div>

          {/* CỘT 3: DETAIL PANEL */}
          <div className="overflow-y-auto p-5 space-y-4 text-left scrollbar-thin bg-transparent">
            {/* TỔNG QUAN HỘI THOẠI */}
            {traceDetail && (
              <div className={`p-4 border rounded-xl space-y-2.5 transition-colors ${isDark ? "bg-zinc-900/40 border-zinc-850" : "bg-blue-50/40 border-blue-100"
                }`}>
                <div className="font-bold text-blue-500 text-[10px] uppercase tracking-wider select-none">
                  📊 TỔNG QUAN HỘI THOẠI (TRACE SUMMARY)
                </div>
                <div className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs transition-colors ${isDark ? "text-zinc-400" : "text-zinc-655"}`}>
                  <div>• Trạng thái: <span className={`font-bold ${traceDetail.trace.status === 'completed' ? 'text-emerald-500' : 'text-zinc-700'}`}>{traceDetail.trace.status}</span></div>
                  <div>• Tổng thời gian: <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{traceDetail.trace.total_duration_ms ? `${(traceDetail.trace.total_duration_ms / 1000).toFixed(2)}s` : 'Đang chạy...'}</span></div>
                  <div>• Số lượng tác vụ: <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{traceDetail.spans.length} spans</span></div>
                  <div>• Bắt đầu: <span className={`font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>{new Date(traceDetail.trace.created_at).toLocaleString()}</span></div>
                </div>
                {traceDetail.trace.output && (
                  <div className={`pt-2.5 border-t mt-1 ${isDark ? "border-zinc-800" : "border-blue-100/60"}`}>
                    <span className="font-bold text-blue-500 text-[11px] block select-none">💬 Câu trả lời của AI:</span>
                    <div className={`mt-1.5 p-3.5 border rounded-lg text-xs leading-relaxed select-text max-h-56 overflow-y-auto whitespace-pre-wrap font-sans transition-colors ${isDark ? "bg-zinc-950 border-zinc-800 text-zinc-200" : "bg-white border-blue-100 text-zinc-800"
                      }`}>
                      {(() => {
                        try {
                          const parsed = JSON.parse(traceDetail.trace.output);
                          return parsed.response || parsed.text || traceDetail.trace.output;
                        } catch {
                          return traceDetail.trace.output;
                        }
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedSpan ? (
              <div className="space-y-4 pt-3 border-t border-zinc-100 mt-2">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs uppercase font-mono font-bold text-zinc-400 tracking-wider mb-1 select-none">Selected Span</h4>
                    <h4 className={`text-sm font-bold font-mono break-all ${isDark ? "text-zinc-100" : "text-zinc-900"}`}>{selectedSpan.name}</h4>
                  </div>
                  <div className="flex gap-2 select-none">
                    <span className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded border ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-655"
                      }`}>
                      {selectedSpan.type}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded ${selectedSpan.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-55 text-red-700 border border-red-200"
                        }`}
                    >
                      {selectedSpan.status}
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-1 text-zinc-500 border-t border-zinc-105 pt-3 select-none">
                  <div className="flex">
                    <span className="w-24">ID:</span>
                    <span className={`font-mono ${isDark ? "text-zinc-350" : "text-zinc-800"}`}>{selectedSpan.id}</span>
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

                {renderSpanInputDetails(selectedSpan)}
                {renderSpanOutputDetails(selectedSpan)}

                {selectedSpan.error && (
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-red-600 select-none">Error Stack:</div>
                    <pre className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-mono text-red-700 overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                      {selectedSpan.error}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-400 text-xs text-center py-20 select-none">Chọn một tác vụ con (span) ở cột giữa để xem chi tiết thực thi</div>
            )}
          </div>
        </>
      ) : (
        <div className={`lg:col-span-2 flex flex-col items-center justify-center text-zinc-400 text-xs py-40 select-none transition-colors ${isDark ? "bg-zinc-950/20" : "bg-zinc-50/10"
          }`}>
          <span className="text-4xl mb-3 animate-bounce">📊</span>
          Chọn một hội thoại (trace) ở cột trái để kiểm tra sơ đồ chi tiết.
        </div>
      )}
    </div>
  );
}