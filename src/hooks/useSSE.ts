// filepath: bridge_client/src/hooks/useSSE.ts
import { useState, useCallback, useRef, useEffect } from 'react';

export interface ExecutionStep {
  id: string;
  type: 'thinking' | 'terminal' | 'read_file' | 'search' | 'generic' | 'agent';
  title: string;
  input?: string;
  output?: string;
  toolName?: string;
}

export interface TimelineItem {
  id: string;
  type: 'text' | 'steps';
  content?: string;
  steps?: ExecutionStep[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string;
  images?: string[];
  steps?: ExecutionStep[];
  timeline?: TimelineItem[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
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
            images: m.images || undefined,
            steps: m.steps || [],
            timeline: m.timeline || undefined,
            usage: m.usage || undefined
          }));
          setMessages(loadedMessages);

          setLogs((prev: LogEntry[]) => [
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

    try {
      const permRes = await fetch('/api/dashboard/permission/active');
      if (permRes.ok) {
        const permData = await permRes.json();
        if (permData.success && permData.permission) {
          setPendingPermission(permData.permission);
        }
      }
    } catch (e) {
      console.error("Không thể tải yêu cầu phê duyệt đang chờ:", e);
    }
  }, []);

  useEffect(() => {
    loadActiveSession();
  }, [loadActiveSession]);

  const sendPrompt = useCallback(async (
    prompt: string,
    useReformulate: boolean,
    images?: string[] | null,
    agent?: string,
    model?: string,
    headless?: boolean,
    mode?: 'default' | 'thinking' | 'fast'
  ) => {
    setIsGenerating(true);
    setPendingPermission(null);
    abortControllerRef.current = new AbortController();

    setMessages((prev: ChatMessage[]) => [
      ...prev,
      { role: 'user', content: prompt, images: images || undefined },
      { role: 'assistant', content: '', steps: [], timeline: [] }
    ]);

    let currentSteps: ExecutionStep[] = [];

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          stream: true,
          useReformulate,
          images,
          agent,
          model,
          headless,
          mode
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
              setMessages((prev: ChatMessage[]) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant') {
                  const updatedTimeline = last.timeline ? [...last.timeline] : [];
                  const lastItem = updatedTimeline[updatedTimeline.length - 1];

                  if (lastItem && lastItem.type === 'text') {
                    updatedTimeline[updatedTimeline.length - 1] = {
                      ...lastItem,
                      content: (lastItem.content || '') + parsed.content
                    };
                  } else {
                    updatedTimeline.push({
                      id: 'text-' + Math.random().toString(36).substring(2, 9),
                      type: 'text',
                      content: parsed.content
                    });
                  }

                  return [
                    ...prev.slice(0, -1),
                    {
                      ...last,
                      content: last.content + parsed.content,
                      timeline: updatedTimeline,
                      usage: parsed.usage || last.usage
                    }
                  ];
                } else {
                  const initialTimeline: TimelineItem[] = [{
                    id: 'text-' + Math.random().toString(36).substring(2, 9),
                    type: 'text',
                    content: parsed.content
                  }];
                  return [
                    ...prev,
                    {
                      role: 'assistant',
                      content: parsed.content,
                      steps: [],
                      timeline: initialTimeline,
                      usage: parsed.usage
                    }
                  ];
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

              setMessages((prev: ChatMessage[]) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  const updatedTimeline = lastMsg.timeline ? [...lastMsg.timeline] : [];
                  const lastItem = updatedTimeline[updatedTimeline.length - 1];

                  if (lastItem && lastItem.type === 'steps' && lastItem.steps) {
                    const updatedSteps = [...lastItem.steps];
                    const lastStep = updatedSteps[updatedSteps.length - 1];
                    if (lastStep && lastStep.type === 'thinking') {
                      updatedSteps[updatedSteps.length - 1] = {
                        ...lastStep,
                        input: (lastStep.input || '') + '\n' + content
                      };
                    } else {
                      updatedSteps.push({
                        id: Math.random().toString(36).substring(2, 9),
                        type: 'thinking',
                        title: 'Thinking process',
                        input: content
                      });
                    }
                    updatedTimeline[updatedTimeline.length - 1] = {
                      ...lastItem,
                      steps: updatedSteps
                    };
                  } else {
                    updatedTimeline.push({
                      id: 'steps-' + Math.random().toString(36).substring(2, 9),
                      type: 'steps',
                      steps: [{
                        id: Math.random().toString(36).substring(2, 9),
                        type: 'thinking',
                        title: 'Thinking process',
                        input: content
                      }]
                    });
                  }

                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMsg,
                      steps: [...currentSteps],
                      timeline: updatedTimeline
                    }
                  ];
                } else {
                  const initialStep: ExecutionStep = {
                    id: Math.random().toString(36).substring(2, 9),
                    type: 'thinking',
                    title: 'Thinking process',
                    input: content
                  };
                  return [
                    ...prev,
                    {
                      role: 'assistant',
                      content: '',
                      steps: [initialStep],
                      timeline: [{
                        id: 'steps-' + Math.random().toString(36).substring(2, 9),
                        type: 'steps',
                        steps: [initialStep]
                      }]
                    }
                  ];
                }
              });
            } else if (parsed.type === 'action') {
              const tool = parsed.tool || '';
              let stepType: 'thinking' | 'terminal' | 'read_file' | 'search' | 'generic' | 'agent' = 'generic';
              let cleanTitle = `Execute ${tool}`;

              if (tool.includes('bash') || tool.includes('command') || tool.includes('run') || tool.includes('terminal')) {
                stepType = 'terminal';
                cleanTitle = `Terminal ${parsed.input || 'Command'}`;
              } else if (tool.includes('list_directory') || tool.includes('dir') || tool === 'ls') {
                stepType = 'read_file';
                const target = parsed.input || parsed.path || parsed.directory_path || parsed.arguments?.file_path || parsed.arguments?.directory || 'folder';
                const displayTarget = typeof target === 'string' && target.length > 60 ? '...' + target.slice(-57) : target;
                cleanTitle = `📂 List Directory: ${displayTarget}`;
              } else if (tool === 'write_file' || tool.includes('write') || tool.includes('replace') || tool.includes('edit')) {
                stepType = 'generic';
                const target = parsed.input || parsed.file_path || 'file';
                const displayTarget = typeof target === 'string' && target.length > 60 ? '...' + target.slice(-57) : target;
                cleanTitle = `📝 Modify File: ${displayTarget}`;
              } else if (tool.includes('read') || tool.includes('view') || tool.includes('file') || tool === 'cat') {
                stepType = 'read_file';
                const target = parsed.input || parsed.path || parsed.file_path || parsed.arguments?.file_path || 'file';
                const displayTarget = typeof target === 'string' && target.length > 60 ? '...' + target.slice(-57) : target;
                cleanTitle = `📄 Read File: ${displayTarget}`;
              } else if (tool.includes('search') || tool.includes('grep') || tool.includes('find')) {
                stepType = 'search';
                cleanTitle = `Search ${parsed.input || parsed.pattern || 'query'}`;
              } else if (parsed.step_id && parsed.step_id.startsWith('worker_')) {
                stepType = 'agent';
                cleanTitle = parsed.tool || 'Worker Agent';
              }

              const newStep: ExecutionStep = {
                id: parsed.step_id || Math.random().toString(36).substring(2, 9),
                type: stepType,
                title: cleanTitle,
                input: parsed.input || parsed.details || '',
                toolName: tool
              };

              currentSteps.push(newStep);

              setMessages((prev: ChatMessage[]) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  const updatedTimeline = lastMsg.timeline ? [...lastMsg.timeline] : [];
                  const lastItem = updatedTimeline[updatedTimeline.length - 1];

                  if (lastItem && lastItem.type === 'steps' && lastItem.steps) {
                    updatedTimeline[updatedTimeline.length - 1] = {
                      ...lastItem,
                      steps: [...lastItem.steps, newStep]
                    };
                  } else {
                    updatedTimeline.push({
                      id: 'steps-' + Math.random().toString(36).substring(2, 9),
                      type: 'steps',
                      steps: [newStep]
                    });
                  }

                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMsg,
                      steps: [...currentSteps],
                      timeline: updatedTimeline
                    }
                  ];
                } else {
                  return [
                    ...prev,
                    {
                      role: 'assistant',
                      content: '',
                      steps: [newStep],
                      timeline: [{
                        id: 'steps-' + Math.random().toString(36).substring(2, 9),
                        type: 'steps',
                        steps: [newStep]
                      }]
                    }
                  ];
                }
              });
            } else if (parsed.type === 'tool_output') {
              const parsedOutput = typeof parsed.output === 'object' ? JSON.stringify(parsed.output, null, 2) : parsed.output;

              // Định nghĩa kiểu rõ ràng cho tham số 's' để tránh lỗi implicit any
              const targetStep = currentSteps.find((s: ExecutionStep) => s.id === parsed.step_id);
              if (targetStep) {
                targetStep.output = parsedOutput;
              } else {
                const lastNonThinking = [...currentSteps].reverse().find((s: ExecutionStep) => s.type !== 'thinking');
                if (lastNonThinking) {
                  lastNonThinking.output = parsedOutput;
                }
              }

              setMessages((prev: ChatMessage[]) => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  const updatedTimeline = lastMsg.timeline ? [...lastMsg.timeline] : [];
                  let updated = false;

                  for (let i = 0; i < updatedTimeline.length; i++) {
                    const item = updatedTimeline[i];
                    if (item.type === 'steps' && item.steps) {
                      const stepIdx = item.steps.findIndex((s: ExecutionStep) => s.id === parsed.step_id);
                      if (stepIdx !== -1) {
                        const newSteps = [...item.steps];
                        newSteps[stepIdx] = {
                          ...newSteps[stepIdx],
                          output: parsedOutput
                        };
                        updatedTimeline[i] = {
                          ...item,
                          steps: newSteps
                        };
                        updated = true;
                        break;
                      }
                    }
                  }

                  if (!updated) {
                    const lastTimelineStepsIdx = updatedTimeline.map((item: TimelineItem) => item.type === 'steps').lastIndexOf(true);
                    if (lastTimelineStepsIdx !== -1) {
                      const item = updatedTimeline[lastTimelineStepsIdx];
                      if (item.steps && item.steps.length > 0) {
                        const newSteps = [...item.steps];
                        const lastNonThinkingIdx = newSteps.map((s: ExecutionStep) => s.type !== 'thinking').lastIndexOf(true);
                        if (lastNonThinkingIdx !== -1) {
                          newSteps[lastNonThinkingIdx] = {
                            ...newSteps[lastNonThinkingIdx],
                            output: parsedOutput
                          };
                          updatedTimeline[lastTimelineStepsIdx] = {
                            ...item,
                            steps: newSteps
                          };
                        }
                      }
                    }
                  }

                  return [
                    ...prev.slice(0, -1),
                    {
                      ...lastMsg,
                      steps: [...currentSteps],
                      timeline: updatedTimeline
                    }
                  ];
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
                const loadedMessages: ChatMessage[] = parsed.history.map((m: any) => ({
                  role: m.role,
                  content: m.content,
                  image: m.image || undefined,
                  images: m.images || undefined,
                  steps: m.steps || [],
                  timeline: m.timeline || undefined,
                  usage: m.usage || undefined
                }));
                setMessages(loadedMessages);
              }
              if (onGenerationComplete) onGenerationComplete();
            }
          } catch (e) {
            // ignore
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

  const respondToPermission = useCallback(async (id: string, response: string) => {
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