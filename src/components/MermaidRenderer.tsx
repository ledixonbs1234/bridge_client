import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './animate-ui/button';
import { motion, AnimatePresence } from 'motion/react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default', // Changed from 'dark' to 'default' for better visibility in light mode
  securityLevel: 'loose',
});

interface MermaidRendererProps {
  code: string;
}

export function MermaidRenderer({ code }: MermaidRendererProps) {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // THÊM: State lưu trữ kích thước logic tự nhiên của sơ đồ để phá vỡ lỗi layout CSS tuần hoàn
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let active = true;

    const renderDiagram = async () => {
      try {
        setError(null);
        await mermaid.parse(code);

        const uniqueId = `mermaid-svg-${Math.round(Math.random() * 10000000)}`;
        const { svg } = await mermaid.render(uniqueId, code);

        if (active) {
          setSvgHtml(svg);
        }
      } catch (err: any) {
        console.error("Mermaid Render Error:", err);
        if (active) {
          setError(err.message || String(err));
        }
      }
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [code]);

  // Giải quyết trạng thái dọn dẹp kích thước khi tắt modal
  useEffect(() => {
    if (!isMaximized) {
      setNaturalSize(null);
    }
  }, [isMaximized]);

  // SỬA ĐỔI: Thuật toán tự động Fit bám sát hệ tọa độ logic nội bộ của SVG và phá bỏ co hẹp CSS
  useEffect(() => {
    if (!isMaximized || !viewportRef.current || !svgHtml) return;

    const container = viewportRef.current;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Đọc kích thước gốc từ các thuộc tính do Mermaid sinh ra
    const svgWidthAttr = svg.getAttribute('width');
    const svgHeightAttr = svg.getAttribute('height');

    // 1. Ưu tiên viewBox vì nó định nghĩa chính xác hệ tọa độ logic bên trong của sơ đồ
    let svgWidth = svg.viewBox?.baseVal?.width;
    let svgHeight = svg.viewBox?.baseVal?.height;

    // 2. Dự phòng: Đọc thuộc tính width/height nếu không phải là tỷ lệ phần trăm (%)
    if (!svgWidth && svgWidthAttr && !svgWidthAttr.includes('%')) {
      svgWidth = parseFloat(svgWidthAttr);
    }
    if (!svgHeight && svgHeightAttr && !svgHeightAttr.includes('%')) {
      svgHeight = parseFloat(svgHeightAttr);
    }

    // 3. Dự phòng cuối: Tự đo đạc kích thước client thực tế
    if (!svgWidth) svgWidth = svg.clientWidth || 800;
    if (!svgHeight) svgHeight = svg.clientHeight || 600;

    // Lưu kích thước cố định này để áp cứng vào Inline Style của khối container
    setNaturalSize({ width: svgWidth, height: svgHeight });

    const containerWidth = container.clientWidth - 48; // Trừ bớt padding
    const containerHeight = container.clientHeight - 48;

    if (svgWidth && svgHeight && containerWidth && containerHeight) {
      const scaleX = containerWidth / svgWidth;
      const scaleY = containerHeight / svgHeight;

      // Chọn tỉ lệ nhỏ hơn để toàn bộ sơ đồ nằm trọn vẹn trong viewport
      // SỬA LỖI: Loại bỏ hoàn toàn giới hạn trần Math.min(1.5, ...) để sơ đồ nhỏ có thể tự động giãn lấp đầy màn hình lớn
      const fitScale = Math.min(scaleX, scaleY);
      setScale(fitScale);
    } else {
      setScale(1);
    }
    setOffset({ x: 0, y: 0 });
  }, [isMaximized, svgHtml]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !isMaximized) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.25; // SỬA: Tăng tốc độ zoom từ 0.08 lên 0.25 để đỡ phải cuộn nhiều
      const direction = e.deltaY < 0 ? 1 : -1;

      setScale(prev => {
        const next = prev + direction * zoomSpeed;
        // SỬA: Thay đổi giới hạn zoom tối đa thành 8.0 (800%) và tối thiểu là 0.1 (10%)
        return Math.min(8, Math.max(0.1, next));
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isMaximized]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMaximized(false);
      }
    };
    if (isMaximized) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMaximized]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSVG = () => {
    if (!svgHtml) return;
    const blob = new Blob([svgHtml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bridge-server-diagram.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenModal = () => {
    setIsMaximized(true);
  };

  // SỬA ĐỔI: Reset view bám sát cấu trúc kích thước logic của sơ đồ
  const handleResetView = () => {
    const container = viewportRef.current;
    if (!container || !naturalSize) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const containerWidth = container.clientWidth - 48;
    const containerHeight = container.clientHeight - 48;

    if (naturalSize.width && naturalSize.height && containerWidth && containerHeight) {
      const fitScale = Math.min(containerWidth / naturalSize.width, containerHeight / naturalSize.height);
      setScale(fitScale);
    } else {
      setScale(1);
    }
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: startOffset.current.x + dx,
      y: startOffset.current.y + dy
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl font-mono text-xs text-red-600 text-left my-2">
        <div className="font-bold text-red-600 mb-1">❌ Lỗi Cú Pháp Mermaid:</div>
        <div className="whitespace-pre-wrap select-text mb-3">{error}</div>
        <div className="text-[10px] text-zinc-500 mb-1 font-bold">Mã nguồn lỗi:</div>
        <pre className="p-2.5 bg-zinc-50 rounded border border-zinc-200 text-zinc-600 overflow-x-auto select-text">{code}</pre>
      </div>
    );
  }

  return (
    <div className="relative group/mermaid bg-zinc-50 border border-zinc-200 rounded-xl p-4 my-3 shadow-inner">
      {/* Action Toolbar on Hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-200 flex gap-1.5 z-10">
        <button
          onClick={handleCopy}
          type="button"
          className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-800 rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm"
        >
          {copied ? 'Đã sao chép ✓' : 'Sao chép mã'}
        </button>
        <button
          onClick={handleDownloadSVG}
          type="button"
          className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-800 rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm"
        >
          Tải ảnh SVG
        </button>
        <button
          onClick={handleOpenModal}
          type="button"
          className="px-2 py-1 bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-600 hover:text-zinc-800 rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm"
        >
          Phóng to 🔍
        </button>
      </div>

      {/* Render diagram container */}
      <div className="overflow-auto flex justify-center items-center min-h-[100px]">
        {svgHtml ? (
          <div
            className="w-full max-w-full overflow-hidden text-center cursor-pointer hover:opacity-90"
            onClick={handleOpenModal}
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="text-zinc-400 text-xs animate-pulse">Đang dựng sơ đồ Mermaid...</div>
        )}
      </div>

      {/* LIGHTBOX ADVANCED LIGHTBOX MODAL */}
      {createPortal(
        <AnimatePresence>
          {isMaximized && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/95 z-[9999] flex flex-col p-6 backdrop-blur-md select-none text-zinc-800"
            >
              {/* Lightbox Header */}
              <div className="flex justify-between items-center mb-4 border-b border-zinc-200 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-800 flex items-center gap-2">
                    <span>🔍</span> Kính lúp sơ đồ thiết kế
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Cuộn chuột để Zoom • Kéo chuột trái để di chuyển • Nhấp đúp để đặt lại kích thước ban đầu.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-zinc-100 rounded-lg border border-zinc-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => setScale(prev => Math.max(0.1, prev - 0.25))}
                      className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-white rounded transition-colors cursor-pointer font-mono font-bold"
                    >
                      -
                    </button>
                    <span
                      onClick={handleResetView}
                      title="Nhấn để Reset về tỷ lệ tối ưu"
                      className="px-3 text-xs font-mono font-bold text-zinc-700 select-none min-w-[60px] text-center cursor-pointer hover:text-blue-600 transition-colors"
                    >
                      {Math.round(scale * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setScale(prev => Math.min(8, prev + 0.25))}
                      className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-800 hover:bg-white rounded transition-colors cursor-pointer font-mono font-bold"
                    >
                      +
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs cursor-pointer border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                    onClick={() => setIsMaximized(false)}
                  >
                    Đóng [Esc]
                  </Button>
                </div>
              </div>

              {/* Grid blueprint background for technical rendering */}
              <div
                ref={viewportRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDoubleClick={handleResetView}
                style={{
                  backgroundImage: 'radial-gradient(#e4e4e7 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
                className={`flex-1 overflow-hidden flex justify-center items-center p-6 bg-zinc-50 border border-zinc-200 rounded-xl relative touch-none select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
              >
                {/* SỬA ĐỒI: Áp dụng trực tiếp kích thước logic gốc của SVG vào width và height của div wrapper */}
                <div
                  className="origin-center"
                  style={{
                    width: naturalSize ? `${naturalSize.width}px` : 'auto',
                    height: naturalSize ? `${naturalSize.height}px` : 'auto',
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                  }}
                  dangerouslySetInnerHTML={{ __html: svgHtml }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}