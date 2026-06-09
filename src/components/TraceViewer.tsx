// filepath: bridge_client/src/components/TraceViewer.tsx
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
}

// Giải mã Base64 an toàn hỗ trợ các ký tự UTF-8 đa ký tự (như tiếng Việt)
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

export function TraceViewer({ reloadTrigger, onViewDiff }: TraceViewerProps) {
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
          className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-blue-50 border-l-4 border-blue-600 pl-1 text-blue-700 font-bold" : "hover:bg-zinc-100 text-zinc-700"
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

  // --- TRỰC QUAN HÓA CỰC CHI TIẾT CÁC LỆNH SỬA FILE (REPLACE/WRITE) ---
  const renderSpanInputDetails = (span: Span) => {
    if (!span.input) return null;
    try {
      const parsed = JSON.parse(span.input);

      if (span.name === 'replace_content_safe') {
        return (
          <div className="space-y-3 bg-zinc-50 p-4 border border-zinc-200 rounded-xl text-xs text-zinc-800 shadow-3xs">
            <div className="font-bold text-blue-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 select-none">
              📝 CHI TIẾT SỬA ĐỔI FILE (REPLACE CONTENT SAFE)
            </div>
            <div className="space-y-1.5 leading-relaxed">
              <div>
                • <b>Tệp tin bị sửa đổi:</b>{" "}
                <button
                  type="button"
                  onClick={() => onViewDiff && onViewDiff(parsed.file_path)}
                  className="bg-zinc-100 px-1.5 py-0.5 rounded text-blue-700 font-mono hover:bg-blue-50 hover:underline border-none cursor-pointer text-xs font-semibold text-left break-all select-text"
                >
                  📄 {parsed.file_path} (Bấm để xem thay đổi 🔍)
                </button>
              </div>
              <div>• <b>Khoảng dòng sửa:</b> <span className="font-semibold text-zinc-700">Dòng {parsed.start_line} đến dòng {parsed.end_line}</span></div>
              {parsed.task_description && <div>• <b>Mô tả công việc:</b> <span className="italic text-zinc-600 font-sans font-medium">{parsed.task_description}</span></div>}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="font-semibold text-rose-700 select-none">❌ Đoạn mã cũ bị xóa (Target Content):</div>
                <pre className="p-3 bg-rose-50 border border-rose-150 rounded-lg text-xs font-mono text-rose-800 overflow-x-auto max-h-40 whitespace-pre select-text leading-normal">
                  {parsed.target_content}
                </pre>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-emerald-700 select-none">✅ Đoạn mã mới được đưa vào (Replacement Content):</div>
                <pre className="p-3 bg-emerald-50 border border-emerald-150 rounded-lg text-xs font-mono text-emerald-850 overflow-x-auto max-h-48 whitespace-pre select-text leading-normal">
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
          <div className="space-y-3 bg-zinc-50 p-4 border border-zinc-200 rounded-xl text-xs text-zinc-800 shadow-3xs">
            <div className="font-bold text-indigo-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 select-none">
              📝 CHI TIẾT SỬA ĐỔI HÀNG LOẠT (REPLACE MULTIPLE FILES)
            </div>
            {parsed.task_description && (
              <div className="leading-relaxed">• <b>Mô tả tác vụ:</b> <span className="italic text-zinc-655 font-sans font-medium">{parsed.task_description}</span></div>
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
                        className="bg-zinc-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono hover:bg-indigo-50 hover:underline border-none cursor-pointer text-xs font-semibold text-left break-all select-text"
                      >
                        📄 {edit.file_path} (Bấm để xem thay đổi 🔍)
                      </button>
                    </div>
                    <div>• <b>Vị trí sửa:</b> <span className="font-semibold text-zinc-700">Dòng {edit.start_line} → {edit.end_line}</span></div>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="font-semibold text-rose-700 text-[10px] select-none">❌ Đoạn mã cũ bị xóa:</div>
                      <pre className="p-2.5 bg-rose-50 border border-rose-100 rounded text-xs font-mono text-rose-800 overflow-x-auto max-h-24 whitespace-pre select-text leading-normal">
                        {edit.target_content}
                      </pre>
                    </div>
                    <div className="space-y-1">
                      <div className="font-semibold text-emerald-700 text-[10px] select-none">✅ Đoạn mã mới thay thế:</div>
                      <pre className="p-2.5 bg-emerald-50 border border-emerald-100 rounded text-xs font-mono text-emerald-850 overflow-x-auto max-h-32 whitespace-pre select-text leading-normal">
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
          <div className="space-y-3 bg-zinc-50 p-4 border border-zinc-200 rounded-xl text-xs text-zinc-800 shadow-3xs">
            <div className="font-bold text-teal-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 select-none">
              💾 CHI TIẾT GHI ĐÈ / TẠO MỚI (WRITE FILE)
            </div>
            <div className="space-y-1 leading-relaxed">
              <div>• <b>Đường dẫn tệp tin:</b> <code className="bg-zinc-100 px-1.5 py-0.5 rounded text-teal-700 font-mono select-text break-all">{parsed.file_path}</code></div>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-teal-700 select-none">📝 Nội dung ghi:</div>
              <pre className="p-3 bg-teal-50/10 border border-teal-200 rounded-lg text-xs font-mono text-zinc-800 overflow-x-auto max-h-48 whitespace-pre select-text leading-normal">
                {content}
              </pre>
            </div>
          </div>
        );
      }
    } catch (e) {
      // Bỏ qua lỗi và fallback về hiển thị JSON
    }

    return (
      <div className="space-y-1">
        <div className="text-xs font-bold text-zinc-500 select-none">Input Data:</div>
        <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-blue-700 overflow-x-auto max-h-48 whitespace-pre-wrap select-text leading-relaxed">
          {span.input}
        </pre>
      </div>
    );
  };

  // --- GIẢI NÉN ĐẦU RA JSON CHO CÁC KHỐI TOOL READ/TEXT/RESPONSE ---
  const renderSpanOutputDetails = (span: Span) => {
    if (!span.output) return null;
    try {
      const parsed = JSON.parse(span.output);
      if (parsed && typeof parsed === 'object') {

        // Giải nén cấu trúc file_reader (chứa .text)
        if (parsed.text && typeof parsed.text === 'string') {
          return (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
              <pre className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre select-text leading-normal">
                {parsed.text}
              </pre>
            </div>
          );
        }

        // Giải nén cấu trúc chatbot (chứa .response)
        if (parsed.response && typeof parsed.response === 'string') {
          return (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-sans text-zinc-800 overflow-y-auto max-h-[500px] whitespace-pre-wrap select-text leading-relaxed">
                {parsed.response}
              </div>
            </div>
          );
        }

        // Giải nén cấu trúc status: success
        if (parsed.status === "success" && parsed.data) {
          const dataStr = typeof parsed.data === 'object' ? JSON.stringify(parsed.data, null, 2) : String(parsed.data);
          return (
            <div className="space-y-1.5">
              <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
              <pre className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-800 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap select-text leading-normal">
                {dataStr}
              </pre>
            </div>
          );
        }

        // Fallback về JSON định dạng đẹp
        return (
          <div className="space-y-1">
            <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
            <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-emerald-850 overflow-x-auto max-h-60 whitespace-pre-wrap select-text leading-relaxed">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          </div>
        );
      }
    } catch (e) {
      // Phản hồi dạng chữ trơn không phải JSON
    }

    return (
      <div className="space-y-1">
        <div className="text-xs font-bold text-zinc-500 select-none">Output Data:</div>
        <pre className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-mono text-emerald-850 overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre-wrap select-text leading-relaxed">
          {span.output}
        </pre>
      </div>
    );
  };

  return (
    // NÂNG CẤP: Loại bỏ hoàn toàn h-[780px] và max-h-[85vh] để chuyển thành h-full w-full co giãn tự do theo kích cỡ màn hình
    <div className="grid grid-cols-1 lg:grid-cols-[260px_280px_1fr] border border-zinc-200 rounded-2xl h-full w-full overflow-hidden bg-white select-text text-zinc-800 shadow-sm">

      {/* CỘT 1: DANH SÁCH TRACES (Khóa cứng 260px) */}
      <div className="border-r border-zinc-200 overflow-y-auto flex flex-col bg-zinc-50/50 select-none">
        <div className="p-4 border-b border-zinc-200 flex justify-between items-center bg-white">
          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">All Traces</span>
          <button onClick={loadTraces} className="text-xs text-blue-600 hover:underline cursor-pointer border-none bg-transparent font-bold">
            Làm mới 🔄
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {traces.map((t) => (
            <div
              key={t.id}
              onClick={() => handleTraceClick(t.id)}
              className={`p-3 cursor-pointer transition-colors text-left ${selectedTraceId === t.id ? "bg-zinc-200/50" : "hover:bg-zinc-100/40"
                }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${t.status === "completed"
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

      {traceDetail ? (
        <>
          {/* CỘT 2: SƠ ĐỒ CÂY SPANS (Khóa cứng 280px) */}
          <div className="border-r border-zinc-200 overflow-y-auto p-4 space-y-2 text-left bg-zinc-50/30 select-none">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Span Hierarchy</h3>
            {traceDetail.spans
              .filter((s) => !s.parent_span_id)
              .map((rootSpan) => renderSpanNode(rootSpan))}
          </div>

          {/* CỘT 3: DETAIL PANEL (Chiếm trọn vẹn toàn bộ không gian 1fr còn lại) */}
          <div className="overflow-y-auto p-5 space-y-4 text-left bg-white scrollbar-thin">
            {/* --- CARD TỔNG QUAN HỘI THOẠI TRACE SUMMARY --- */}
            {traceDetail && (
              <div className="p-4 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2.5">
                <div className="font-bold text-blue-800 text-[10px] uppercase tracking-wider select-none">
                  📊 TỔNG QUAN HỘI THOẠI (TRACE SUMMARY)
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-zinc-650">
                  <div>• Trạng thái: <span className={`font-bold ${traceDetail.trace.status === 'completed' ? 'text-emerald-600' : 'text-zinc-700'}`}>{traceDetail.trace.status}</span></div>
                  <div>• Tổng thời gian: <span className="font-semibold text-zinc-800">{traceDetail.trace.total_duration_ms ? `${(traceDetail.trace.total_duration_ms / 1000).toFixed(2)}s` : 'Đang chạy...'}</span></div>
                  <div>• Số lượng tác vụ: <span className="font-semibold text-zinc-800">{traceDetail.spans.length} spans</span></div>
                  <div>• Bắt đầu: <span className="font-semibold text-zinc-800">{new Date(traceDetail.trace.created_at).toLocaleString()}</span></div>
                </div>
                {traceDetail.trace.output && (
                  <div className="pt-2.5 border-t border-blue-100/60 mt-1">
                    <span className="font-bold text-blue-800 text-[11px] block select-none">💬 Câu trả lời của AI:</span>
                    <div className="mt-1.5 bg-white p-3.5 border border-blue-100 rounded-lg text-xs leading-relaxed text-zinc-800 select-text max-h-56 overflow-y-auto whitespace-pre-wrap font-sans">
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
                    <h4 className="text-sm font-bold text-zinc-900 font-mono break-all">{selectedSpan.name}</h4>
                  </div>
                  <div className="flex gap-2 select-none">
                    <span className="text-[9px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
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

                <div className="text-xs space-y-1 text-zinc-500 border-t border-zinc-100 pt-3 select-none">
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

                {/* Bản hiển thị Input chi tiết đã tùy biến */}
                {renderSpanInputDetails(selectedSpan)}

                {/* Bản hiển thị Output đã giải nén JSON */}
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
        /* Khi chưa chọn Trace nào, hiển thị bọc trống trải rộng trên cả cột 2 và cột 3 */
        <div className="lg:col-span-2 flex flex-col items-center justify-center text-zinc-400 text-xs py-40 bg-zinc-50/10 select-none">
          <span className="text-4xl mb-3 animate-bounce">📊</span>
          Chọn một hội thoại (trace) ở cột trái để kiểm tra sơ đồ chi tiết.
        </div>
      )}
    </div>
  );
}