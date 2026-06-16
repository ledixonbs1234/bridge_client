// filepath: ridge_client/src/components/SkillTester.tsx
import * as React from "react";
import { useState, useCallback } from "react";
import { Button } from "./animate-ui/button";
import { ChatMessage, ExecutionStep, PermissionRequest } from "../hooks/useSSE";

interface SkillTesterProps {
    sse: {
        messages: ChatMessage[];
        setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
        setPendingPermission: React.Dispatch<React.SetStateAction<PermissionRequest | null>>;
    };
    theme?: "light" | "dark";
}

interface SimulatedEvent {
    type: "chunk" | "log" | "action" | "output";
    delay: number;
    content?: string;
    tool?: string;
    input?: string;
    output?: string;
    stepId?: string;
}

export function SkillTester({ sse, theme = "light" }: SkillTesterProps) {
    const { setMessages, setPendingPermission } = sse;
    const isDark = theme === "dark";

    const [rawInputText, setRawInputText] = useState<string>(`📖 [FluxMem Stage I] Đang truy xuất đồ thị bộ nhớ đa lớp bằng Semantic Search...
Để đánh giá chính xác mức độ hoàn chỉnh và các điểm cần nâng cấp của dự án, tôi cần khảo sát cấu trúc và mã nguồn thực tế của nó trước. Tôi sẽ bắt đầu bằng việc liệt kê các tệp và thư mục trong dự án.

{
  "type": "tool_call",
  "name": "list_directory",
  "arguments": {
    "path": "H:/DATA/CTHANG/PromptManager",
    "depth": 3
  }
}

Gọi Tool: 📂 List Directory: H:/DATA/CTHANG/PromptManager
path→H:/DATA/CTHANG/PromptManager
depth→3
{
  "type": "tool_call",
  "name": "read_multiple_files",
  "arguments": {
    "file_paths": [
      "H:/DATA/CTHANG/PromptManager/PromptManager.csproj",
      "H:/DATA/CTHANG/PromptManager/MainWindow.xaml",
      "H:/DATA/CTHANG/PromptManager/MainWindow.xaml.cs",
      "H:/DATA/CTHANG/PromptManager/MainViewModel.cs",
      "H:/DATA/CTHANG/PromptManager/Models/PromptItem.cs",
      "H:/DATA/CTHANG/PromptManager/PromptItem.cs"
    ]
  }
}

Gọi Tool: 📄 Read File: ...NG/PromptManager/PromptManager.csproj
file_paths→["H:/DATA/CTHANG/PromptManager/PromptManager.csproj","H:/DATA/CTHANG/PromptManager/MainWindow.xaml","H:/DATA/CTHANG/PromptManager/MainWindow.xaml.cs","H:/DATA/CTHANG/PromptManager/MainViewModel.cs","H:/DATA/CTHANG/PromptManager/Models/PromptItem.cs","H:/DATA/CTHANG/PromptManager/PromptItem.cs"]
{
  "type": "tool_call",
  "name": "ask_questions_if_underspecified",
  "arguments": {
    "explanation": "Dự án của bạn về cơ bản đã hoạt động tốt với các chức năng chính: thêm, xóa, sao chép và lưu trữ prompt vào file JSON. Tuy nhiên, qua quá trình phân tích mã nguồn, tôi phát hiện một số điểm có thể cải thiện để ứng dụng hoàn chỉnh và chuyên nghiệp hơn. Tôi cần xác nhận hướng nâng cấp mà bạn mong muốn trước khi thực hiện thay đổi.",
    "questions": [
      {
        "id": "cleanup_duplicate",
        "question": "Hiện tại có 2 file định nghĩa class 'PromptItem' (một ở thư mục gốc và một trong thư mục Models) gây trùng lặp. Bạn có muốn tôi dọn dẹp, gộp chúng lại thành một file chuẩn hóa (khuyên dùng file trong thư mục Models với kiểu dữ liệu Guid) không?",
        "type": "select",
        "options": [
          {
            "label": "Có, hãy dọn dẹp và chuẩn hóa class PromptItem",
            "value": "yes_cleanup",
            "is_default": true
          },
          {
            "label": "Không, giữ nguyên hiện tại",
            "value": "no_cleanup"
          }
        ]
      },
      {
        "id": "feature_enhancement",
        "question": "Bạn muốn bổ sung thêm những tính năng nào sau đây để nâng cấp ứng dụng? (Có thể chọn nhiều)",
        "type": "multi_select",
        "options": [
          {
            "label": "Thêm ô Tìm kiếm/Lọc danh sách Prompt",
            "value": "search_filter",
            "is_default": true
          },
          {
            "label": "Thêm tính năng Chỉnh sửa (Edit) nội dung Prompt đã có",
            "value": "edit_prompt",
            "is_default": true
          },
          {
            "label": "Tự động sắp xếp danh sách theo thời gian tạo (mới nhất lên đầu)",
            "value": "auto_sort",
            "is_default": false
          },
          {
            "label": "Cải thiện cơ chế hiển thị thông báo (tối ưu DispatcherTimer hiện tại)",
            "value": "notification_optimize",
            "is_default": false
          }
        ],
        "allow_custom": true
      },
      {
        "id": "ui_polish",
        "question": "Về giao diện, bạn có muốn tôi sửa các lỗi nhỏ như dòng comment bị lặp trong MainWindow.xaml và tinh chỉnh lại khoảng cách/hiệu ứng cho đẹp mắt hơn không?",
        "type": "select",
        "options": [
          {
            "label": "Có, hãy tinh chỉnh lại giao diện cho gọn gàng",
            "value": "yes_ui_polish",
            "is_default": true
          },
          {
            "label": "Không cần, giao diện hiện tại là ổn",
            "value": "no_ui_polish"
          }
        ]
      }
    ]
  }
}`);

    const [isRunningSim, setIsRunningSim] = useState(false);

    // 1. Phân phối text chunk
    const simulateChunk = useCallback((text: string) => {
        setMessages((prev) => {
            const next = [...prev];
            if (next.length === 0) return prev;
            const last = next[next.length - 1];
            if (last.role !== "assistant") return prev;

            const timeline = last.timeline ? [...last.timeline] : [];
            const lastItem = timeline[timeline.length - 1];

            if (lastItem && lastItem.type === "text") {
                timeline[timeline.length - 1] = {
                    ...lastItem,
                    content: (lastItem.content || "") + text
                };
            } else {
                timeline.push({
                    id: "sim-text-" + Math.random().toString(36).substring(2, 9),
                    type: "text",
                    content: text
                });
            }

            return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + text, timeline }
            ];
        });
    }, [setMessages]);

    // 2. Phân phối log
    const simulateLog = useCallback((text: string) => {
        setMessages((prev) => {
            const next = [...prev];
            if (next.length === 0) return prev;
            const lastMsg = next[next.length - 1];
            if (lastMsg.role !== "assistant") return prev;

            const currentSteps = lastMsg.steps ? [...lastMsg.steps] : [];
            const lastStep = currentSteps[currentSteps.length - 1];

            if (lastStep && lastStep.type === "thinking") {
                lastStep.input = (lastStep.input || "") + "\n" + text;
            } else {
                currentSteps.push({
                    id: "sim-think-" + Math.random().toString(36).substring(2, 9),
                    type: "thinking",
                    title: "Thinking process",
                    input: text
                });
            }

            const timeline = lastMsg.timeline ? [...lastMsg.timeline] : [];
            const lastItem = timeline[timeline.length - 1];

            if (lastItem && lastItem.type === "steps" && lastItem.steps) {
                const updatedSteps = [...lastItem.steps];
                const lastTStep = updatedSteps[updatedSteps.length - 1];
                if (lastTStep && lastTStep.type === "thinking") {
                    updatedSteps[updatedSteps.length - 1] = {
                        ...lastTStep,
                        input: (lastTStep.input || "") + "\n" + text
                    };
                } else {
                    updatedSteps.push({
                        id: "sim-think-" + Math.random().toString(36).substring(2, 9),
                        type: "thinking",
                        title: "Thinking process",
                        input: text
                    });
                }
                timeline[timeline.length - 1] = { ...lastItem, steps: updatedSteps };
            } else {
                timeline.push({
                    id: "sim-steps-" + Math.random().toString(36).substring(2, 9),
                    type: "steps",
                    steps: [{
                        id: "sim-think-" + Math.random().toString(36).substring(2, 9),
                        type: "thinking",
                        title: "Thinking process",
                        input: text
                    }]
                });
            }

            return [...prev.slice(0, -1), { ...lastMsg, steps: currentSteps, timeline }];
        });
    }, [setMessages]);

    // 3. Phân phối action
    const simulateAction = useCallback((tool: string, inputVal: string, stepId: string) => {
        let cleanTitle = `Execute ${tool}`;
        let stepType: "thinking" | "terminal" | "read_file" | "search" | "generic" | "agent" = "generic";

        if (tool === "list_directory") {
            stepType = "read_file";
            cleanTitle = "📂 List Directory";
        } else if (tool === "read_multiple_files") {
            stepType = "read_file";
            cleanTitle = "📄 Read Files";
        } else if (tool === "ask_questions_if_underspecified") {
            stepType = "agent";
            cleanTitle = "❓ Clarify Requirements";
        }

        const newStep: ExecutionStep = {
            id: stepId,
            type: stepType,
            title: cleanTitle,
            input: inputVal,
            toolName: tool
        };

        setMessages((prev) => {
            const next = [...prev];
            if (next.length === 0) return prev;
            const lastMsg = next[next.length - 1];
            if (lastMsg.role !== "assistant") return prev;

            const steps = lastMsg.steps ? [...lastMsg.steps, newStep] : [newStep];
            const timeline = lastMsg.timeline ? [...lastMsg.timeline] : [];
            const lastItem = timeline[timeline.length - 1];

            if (lastItem && lastItem.type === "steps" && lastItem.steps) {
                timeline[timeline.length - 1] = {
                    ...lastItem,
                    steps: [...lastItem.steps, newStep]
                };
            } else {
                timeline.push({
                    id: "sim-steps-" + Math.random().toString(36).substring(2, 9),
                    type: "steps",
                    steps: [newStep]
                });
            }

            return [...prev.slice(0, -1), { ...lastMsg, steps, timeline }];
        });
    }, [setMessages]);

    // 4. Phân phối output
    const simulateOutput = useCallback((outputVal: string, stepId: string) => {
        setMessages((prev) => {
            const next = [...prev];
            if (next.length === 0) return prev;
            const lastMsg = next[next.length - 1];
            if (lastMsg.role !== "assistant") return prev;

            const steps = lastMsg.steps ? [...lastMsg.steps] : [];
            const targetStep = steps.find((s) => s.id === stepId);
            if (targetStep) targetStep.output = outputVal;

            const timeline = lastMsg.timeline ? [...lastMsg.timeline] : [];
            for (let i = 0; i < timeline.length; i++) {
                const item = timeline[i];
                if (item.type === "steps" && item.steps) {
                    const sIdx = item.steps.findIndex((s) => s.id === stepId);
                    if (sIdx !== -1) {
                        const nextSteps = [...item.steps];
                        nextSteps[sIdx] = { ...nextSteps[sIdx], output: outputVal };
                        timeline[i] = { ...item, steps: nextSteps };
                        break;
                    }
                }
            }

            return [...prev.slice(0, -1), { ...lastMsg, steps, timeline }];
        });
    }, [setMessages]);

    // 5. Giải mã text thô thành luồng hành động và rẽ nhánh thông minh
    const parseRawTextToEvents = (rawText: string): SimulatedEvent[] => {
        const events: SimulatedEvent[] = [];
        let i = 0;
        let lastTextIndex = 0;

        while (i < rawText.length) {
            if (rawText[i] === "{") {
                let braceCount = 1;
                let j = i + 1;
                while (j < rawText.length && braceCount > 0) {
                    if (rawText[j] === "{") braceCount++;
                    else if (rawText[j] === "}") braceCount--;
                    j++;
                }

                if (braceCount === 0) {
                    const potentialJson = rawText.substring(i, j);
                    try {
                        const parsed = JSON.parse(potentialJson);
                        if (parsed && (parsed.type === "tool_call" || parsed.name)) {
                            const precedingText = rawText.substring(lastTextIndex, i).trim();
                            if (precedingText) {
                                events.push({ type: "chunk", content: precedingText, delay: 600 });
                            }

                            const stepId = `step-${parsed.name || parsed.tool_call?.name}-${Math.random().toString(36).substring(2, 7)}`;
                            const finalName = parsed.name || parsed.tool_call?.name || "unknown";
                            const finalArgs = parsed.arguments || parsed.tool_call?.arguments || {};

                            events.push({
                                type: "action",
                                tool: finalName,
                                input: JSON.stringify(finalArgs),
                                stepId,
                                delay: 1000
                            });

                            i = j;
                            lastTextIndex = j;
                            continue;
                        }
                    } catch {
                        // ignore JSON errors
                    }
                }
            }
            i++;
        }

        const remainingText = rawText.substring(lastTextIndex).trim();
        if (remainingText) {
            events.push({ type: "chunk", content: remainingText, delay: 600 });
        }

        // Gộp nối văn bản đứng sau tool call để tự chuyển thành Output của tool đó
        const finalEvents: SimulatedEvent[] = [];
        for (let idx = 0; idx < events.length; idx++) {
            const current = events[idx];
            if (current.type === "action" && idx + 1 < events.length) {
                const next = events[idx + 1];
                if (next.type === "chunk" && next.content) {
                    finalEvents.push(current);
                    finalEvents.push({
                        type: "output",
                        output: next.content,
                        stepId: current.stepId,
                        delay: 800
                    });
                    idx++;
                    continue;
                }
            }
            finalEvents.push(current);
        }

        return finalEvents;
    };

    const handleStartParsingSimulation = async () => {
        if (!rawInputText.trim() || isRunningSim) return;

        setIsRunningSim(true);
        setPendingPermission(null);

        // Tạo tin nhắn rỗng đầu tiên
        setMessages((prev) => [
            ...prev,
            { role: "user", content: "Giả lập: Phân tích luồng văn bản AI thô" },
            { role: "assistant", content: "", steps: [], timeline: [] }
        ]);

        const simulatedSteps = parseRawTextToEvents(rawInputText);

        for (const step of simulatedSteps) {
            await new Promise((r) => setTimeout(r, step.delay));

            if (step.type === "chunk" && step.content) {
                if (step.content.startsWith("📖") || step.content.startsWith("[")) {
                    simulateLog(step.content);
                } else {
                    simulateChunk(step.content + "\n\n");
                }
            } else if (step.type === "action" && step.tool && step.input && step.stepId) {
                simulateAction(step.tool, step.input, step.stepId);

                // Phát tín hiệu mở biểu mẫu câu hỏi nếu AI chạy ask_questions_if_underspecified
                if (step.tool === "ask_questions_if_underspecified") {
                    try {
                        const parsedArgs = JSON.parse(step.input);
                        setPendingPermission({
                            id: step.stepId,
                            query: "AI đang yêu cầu làm rõ một số bối cảnh kỹ thuật.",
                            details: JSON.stringify({
                                type: "structured_questions",
                                explanation: parsedArgs.explanation,
                                questions: parsedArgs.questions
                            })
                        });
                    } catch { /* skip */ }
                }
            } else if (step.type === "output" && step.output && step.stepId) {
                simulateOutput(step.output, step.stepId);
            }
        }

        setIsRunningSim(false);
    };

    return (
        <div className={`space-y-6 text-left transition-colors duration-200 ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
            <div className={`border p-5 rounded-xl shadow-xs transition-colors duration-200 ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 select-none">
                    <span>🧪</span> Live Raw Decoder (Bản phân tích cú pháp biểu thức thô)
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed font-semibold">
                    Hãy dán toàn bộ đoạn phản hồi dạng text thô của AI dưới đây (kèm các lệnh Gọi Tool, JSON thô, tham số...). Trình giả lập sẽ tự động phân tích cú pháp biểu thức, định vị các thẻ `tool_call` để rải và vẽ Nodes tương ứng trên sơ đồ Visual Flow theo thời gian thực.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div className={`border p-5 rounded-xl space-y-4 transition-colors ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200 shadow-xs"}`}>
                    <div className="flex justify-between items-center border-b pb-2 select-none">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                            Dữ liệu AI thô để phân tích (AI Raw Log Stream)
                        </h4>
                        <span className="text-[10px] text-zinc-500 font-mono font-bold">Chuỗi JSON tự động định vị</span>
                    </div>

                    <textarea
                        value={rawInputText}
                        onChange={(e) => setRawInputText(e.target.value)}
                        disabled={isRunningSim}
                        rows={15}
                        className={`w-full p-4 border rounded-xl text-xs font-mono outline-none leading-relaxed transition-colors ${isDark ? "bg-zinc-950 border-zinc-850 text-zinc-300 focus:border-zinc-700" : "bg-zinc-50 border-zinc-200 text-zinc-850 focus:border-zinc-300"}`}
                    />

                    <div className="flex justify-end select-none">
                        <Button
                            onClick={handleStartParsingSimulation}
                            disabled={isRunningSim || !rawInputText.trim()}
                            className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold border-none text-xs cursor-pointer shadow-md"
                        >
                            {isRunningSim ? "⏳ Đang chạy giả lập & bóc tách..." : "▶ Bắt đầu bóc tách & Chạy giả lập"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}