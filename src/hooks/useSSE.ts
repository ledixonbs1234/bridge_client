import { useState, useCallback, useRef, useEffect } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LogEntry {
  timestamp: string;
  text: string;
  type: 'default' | 'tool-call' | 'tool-output' | 'error' | 'thinking';
}

export interface PermissionRequest {
  id: string;
  query: string;
  details?: string;
}

export function useSSE() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // =================================================================
  // 💾 KHÔI PHỤC PHIÊN CHAT ĐANG HOẠT ĐỘNG (ACTIVE SESSION)
  // =================================================================
  const loadActiveSession = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/sessions/active');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.active && data.messages) {
          // Khôi phục lịch sử chat thô sạch từ backend
          const loadedMessages: ChatMessage[] = data.messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }));
          setMessages(loadedMessages);
          
          setLogs((prev) => [
            ...prev,
            {
              timestamp: new Date().toLocaleTimeString(),
              text: `💾 Đã khôi phục hoàn chỉnh lịch sử phiên chat: ${data.filename}`,
              type: 'default'
            }
          ]);
        }
      }
    } catch (e) {
      console.error("Không thể khôi phục phiên chat đang hoạt động:", e);
    }
  }, []);

  // Tự động chạy ngay khi người dùng nạp trang web
  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  const sendPrompt = useCallback(async (prompt: string, useReformulate: boolean) => {
    setIsGenerating(true);
    setPendingPermission(null);
    abortControllerRef.current = new AbortController();

    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, stream: true, useReformulate }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(cleanLine.substring(6));
            
            if (parsed.type === 'chunk') {
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...last, content: last.content + parsed.content }];
                } else {
                  return [...prev, { role: 'assistant', content: parsed.content }];
                }
              });
            } else if (parsed.type === 'log') {
              setLogs((prev) => [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                text: parsed.content,
                type: 'default'
              }]);
            } else if (parsed.type === 'action') {
              setLogs((prev) => [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                text: `Kích hoạt Skill: ${parsed.tool}`,
                type: 'tool-call'
              }]);
            } else if (parsed.type === 'tool_output') {
              setLogs((prev) => [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                text: typeof parsed.output === 'object' ? JSON.stringify(parsed.output, null, 2) : parsed.output,
                type: 'tool-output'
              }]);
            } else if (parsed.type === 'ask_permission') {
              setPendingPermission({
                id: parsed.id,
                query: parsed.query,
                details: parsed.details
              });
            } else if (parsed.type === 'done') {
              // ĐỒNG BỘ HÓA KHI KẾT THÚC HỘI THOẠI HOẶC SỬ DỤNG /CLEAR /NEW
              if (parsed.history) {
                setMessages(parsed.history.map((m: any) => ({
                  role: m.role,
                  content: m.content
                })));
              }
              setLogs((prev) => [...prev, {
                timestamp: new Date().toLocaleTimeString(),
                text: `✅ Tiến trình hoàn tất thành công.`,
                type: 'default'
              }]);
            }
          } catch (e) {
            // Bỏ qua lỗi dòng thô
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setLogs((prev) => [...prev, { timestamp: new Date().toLocaleTimeString(), text: e.message, type: 'error' }]);
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const respondToPermission = useCallback(async (id: string, response: 'y' | 'n' | 'a') => {
    try {
      const res = await fetch('/api/dashboard/permission/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, response }),
      });
      if (res.ok) {
        setPendingPermission(null);
      }
    } catch (e) {
      console.error("Lỗi khi gửi phản hồi phê duyệt:", e);
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setPendingPermission(null);
  }, []);

  return { messages, logs, pendingPermission, isGenerating, sendPrompt, respondToPermission, stopGeneration, setMessages, setLogs };
}