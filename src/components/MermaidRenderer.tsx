import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './animate-ui/button';
import { motion, AnimatePresence } from 'motion/react';
import mermaid from 'mermaid';

// Khởi tạo cấu hình Mermaid tĩnh ngoài vòng đời React
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
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
  
  // Các trạng thái và tham chiếu phục vụ Zoom & Pan
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  // Biên dịch sơ đồ Mermaid sang mã SVG
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

  // Đăng ký sự kiện cuộn chuột không passive (non-passive wheel event) trên viewport để ngăn cuộn trang chính
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !isMaximized) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); // Chặn hành vi cuộn dọc mặc định của trình duyệt
      
      const zoomSpeed = 0.08;
      const direction = e.deltaY < 0 ? 1 : -1;
      
      setScale(prev => {
        const next = prev + direction * zoomSpeed;
        return Math.min(4, Math.max(0.25, next)); // Giới hạn zoom từ 25% đến 400%
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isMaximized]);

  // Lắng nghe phím ESC để hỗ trợ đóng nhanh cửa sổ phóng to
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

  // --- CÁC HÀM THAO TÁC CƠ BẢN ---
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
    setScale(1);
    setOffset({ x: 0, y: 0 }); // Khởi động lại vị trí tâm khi mở
  };

  const handleResetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  // --- THIẾT LẬP KÉO THẢ (PANNING) BẰNG POINTER EVENTS ---
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Chỉ cho phép kéo bằng chuột trái (button === 0)
    if (e.button !== 0) return;
    
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    
    // Khóa con trỏ vào khung đang tương tác để tránh bị nhả kéo khi di chuyển nhanh ngoài biên
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
      <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl font-mono text-xs text-red-400 text-left my-2">
        <div className="font-bold text-red-500 mb-1">❌ Lỗi Cú Pháp Mermaid:</div>
        <div className="whitespace-pre-wrap select-text mb-3">{error}</div>
        <div className="text-[10px] text-zinc-500 mb-1 font-bold">Mã nguồn lỗi:</div>
        <pre className="p-2.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-400 overflow-x-auto select-text">{code}</pre>
      </div>
    );
  }

  return (
    <div className="relative group/mermaid bg-zinc-950/40 border border-zinc-800/80 rounded-xl p-4 my-3 shadow-inner">
      {/* Thanh công cụ hover */}
      <div className="absolute top-2 right-2 opacity-0 group-hover/mermaid:opacity-100 transition-opacity duration-200 flex gap-1.5 z-10">
        <button
          onClick={handleCopy}
          type="button"
          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm"
        >
          {copied ? 'Đã sao chép ✓' : 'Sao chép mã'}
        </button>
        <button
          onClick={handleDownloadSVG}
          type="button"
          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm"
        >
          Tải ảnh SVG
        </button>
        <button
          onClick={handleOpenModal}
          type="button"
          className="px-2 py-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 rounded text-[10px] font-semibold cursor-pointer transition-colors shadow-sm"
        >
          Phóng to 🔍
        </button>
      </div>

      {/* Hiển thị sơ đồ dạng thu nhỏ (thumbnail) bên trong chat */}
      <div className="overflow-auto flex justify-center items-center min-h-[100px]">
        {svgHtml ? (
          <div 
            className="w-full max-w-full overflow-hidden text-center cursor-pointer hover:opacity-90" 
            onClick={handleOpenModal}
            dangerouslySetInnerHTML={{ __html: svgHtml }} 
          />
        ) : (
          <div className="text-zinc-500 text-xs animate-pulse">Đang dựng sơ đồ Mermaid...</div>
        )}
      </div>

      {/* MODAL KÍNH LÚP NÂNG CAO (Zoom & Pan & Reset & Double Click) */}
      {createPortal(
        <AnimatePresence>
          {isMaximized && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/95 z-[9999] flex flex-col p-6 backdrop-blur-md select-none"
            >
              {/* Header của Modal */}
              <div className="flex justify-between items-center mb-4 border-b border-zinc-800/85 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    <span>🔍</span> Kính lúp sơ đồ thiết kế
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    Cuộn chuột để Zoom • Kéo chuột trái để Di chuyển • Nhấp đúp để đặt lại kích thước ban đầu.
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Thanh điều khiển tỉ lệ zoom cơ học */}
                  <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
                    <button 
                      type="button"
                      onClick={() => setScale(prev => Math.max(0.25, prev - 0.25))}
                      className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 rounded transition-colors cursor-pointer font-mono font-bold"
                    >
                      -
                    </button>
                    <span 
                      onClick={handleResetView}
                      title="Nhấn để Reset về 100%"
                      className="px-3 text-xs font-mono font-bold text-zinc-300 select-none min-w-[60px] text-center cursor-pointer hover:text-blue-400 transition-colors"
                    >
                      {Math.round(scale * 100)}%
                    </span>
                    <button 
                      type="button"
                      onClick={() => setScale(prev => Math.min(4, prev + 0.25))}
                      className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-850 rounded transition-colors cursor-pointer font-mono font-bold"
                    >
                      +
                    </button>
                  </div>

                  <Button 
                    variant="outline"
                    size="sm" 
                    className="h-8 text-xs cursor-pointer"
                    onClick={() => setIsMaximized(false)}
                  >
                    Đóng [Esc]
                  </Button>
                </div>
              </div>

              {/* Vùng tương tác Drag & Zoom (Canvas Viewport) */}
              <div 
                ref={viewportRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDoubleClick={handleResetView}
                className={`flex-1 overflow-hidden flex justify-center items-center p-6 bg-zinc-900/20 border border-zinc-800/40 rounded-xl relative touch-none select-none ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
              >
                {/* Thành phần sơ đồ SVG */}
                <div 
                  className="origin-center"
                  style={{ 
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    // Tắt hoàn toàn transition khi kéo để đảm bảo không bị khựng hình (lag)
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