import { useState, useCallback, useRef, useEffect } from 'react';

export interface ExecutionStep {
  id: string;
  type: 'thinking' | 'terminal' | 'read_file' | 'search' | 'generic';
  title: string;
  input?: string;
  output?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string;
  steps?: ExecutionStep[];
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

export function useSSE(onGenerationComplete?: () => void) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PermissionRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadActiveSession = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/sessions/active');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.active && data.messages) {
          const loadedMessages: ChatMessage[] = data.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            image: m.image || undefined,
            steps: m.steps || []
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
      console.error("Không thể khôi phục phiên chat:", e);
    }
  }, []);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  const sendPrompt = useCallback(async (
    prompt: string,
    useReformulate: boolean,
    image?: string | null,
    agent?: string,
    model?: string,
    headless?: boolean // THÊM THAM SỐ NÀY
  ) => {
    setIsGenerating(true);
    setPendingPermission(null);
    abortControllerRef.current = new AbortController();

    setMessages((prev) => [...prev, { role: 'user', content: prompt, image: image || undefined }]);

    let currentSteps: ExecutionStep[] = [];

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          stream: true,
          useReformulate,
          image,
          agent,
          model,
          headless
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          if (onGenerationComplete) onGenerationComplete();
          break;
        }

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
                  return [...prev, { role: 'assistant', content: parsed.content, steps: [...currentSteps] }];
                }
              });
            } else if (parsed.type === 'log') {
              const content = parsed.content || '';
              const last = currentSteps[currentSteps.length - 1];
              if (last && last.type === 'thinking') {
                last.input = (last.input || '') + '\n' + content;
              } else {
                currentSteps.push({
                  id: Math.random().toString(36).substring(2, 9),
                  type: 'thinking',
                  title: 'Thinking process',
                  input: content
                });
              }
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...lastMsg, steps: [...currentSteps] }];
                } else {
                  return [...prev, { role: 'assistant', content: '', steps: [...currentSteps] }];
                }
              });
            } else if (parsed.type === 'action') {
              const tool = parsed.tool || '';
              let stepType: 'terminal' | 'read_file' | 'search' | 'generic' = 'generic';
              let cleanTitle = `Execute ${tool}`;

              if (tool.includes('bash') || tool.includes('command') || tool.includes('run') || tool.includes('terminal')) {
                stepType = 'terminal';
                cleanTitle = `Terminal ${parsed.input || 'Command'}`;
              } else if (tool.includes('read') || tool.includes('view') || tool.includes('file')) {
                stepType = 'read_file';
                cleanTitle = `Read File ${parsed.input || parsed.path || 'file'}`;
              } else if (tool.includes('search') || tool.includes('grep') || tool.includes('find')) {
                stepType = 'search';
                cleanTitle = `Search ${parsed.input || parsed.pattern || 'query'}`;
              }

              currentSteps.push({
                id: Math.random().toString(36).substring(2, 9),
                type: stepType,
                title: cleanTitle,
                input: parsed.input || parsed.details || ''
              });
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...lastMsg, steps: [...currentSteps] }];
                } else {
                  return [...prev, { role: 'assistant', content: '', steps: [...currentSteps] }];
                }
              });
            } else if (parsed.type === 'tool_output') {
              if (currentSteps.length > 0) {
                const last = currentSteps[currentSteps.length - 1];
                last.output = typeof parsed.output === 'object' ? JSON.stringify(parsed.output, null, 2) : parsed.output;
              }
              setMessages((prev) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  return [...prev.slice(0, -1), { ...lastMsg, steps: [...currentSteps] }];
                }
                return prev;
              });
            } else if (parsed.type === 'ask_permission') {
              setPendingPermission({
                id: parsed.id,
                query: parsed.query,
                details: parsed.details
              });
            } else if (parsed.type === 'done') {
              if (parsed.history) {
                setMessages(parsed.history.map((m: any) => ({
                  role: m.role,
                  content: m.content,
                  image: m.image || undefined,
                  steps: m.steps || []
                })));
              }
              if (onGenerationComplete) onGenerationComplete();
            }
          } catch (e) {
            // Bỏ qua lỗi dòng thô
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.error(e);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [onGenerationComplete]);

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
      console.error(e);
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