// filepath: bridge_client/src/components/terminal/ChatInputForm.tsx
import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../animate-ui/button";

interface ProviderInfo {
    key: string;
    name: string;
}

interface CommandInfo {
    cmd: string;
    alias: string | null;
    desc: string;
    category: string;
}

interface ModelOption {
    provider: string;
    model: string;
    displayName: string;
}

const ALL_MODEL_OPTIONS: ModelOption[] = [
    { provider: "qwen-web", model: "Qwen3.7-Plus", displayName: "Qwen3.7-Plus" },
    { provider: "qwen-web", model: "Qwen3.7-Max", displayName: "Qwen3.7-Max" },
    { provider: "qwen-web", model: "Qwen3.6-Plus", displayName: "Qwen3.6-Plus" },
    { provider: "deepseek-web", model: "deepseek-reasoner", displayName: "DeepSeek Reasoner" },
    { provider: "deepseek-web", model: "deepseek-chat", displayName: "DeepSeek Chat" },
    { provider: "gemini-studio", model: "gemini-studio", displayName: "Gemini Studio" },
    { provider: "openai", model: "gemini", displayName: "OpenAI: Gemini" },
    { provider: "openai", model: "gpt-4o", displayName: "OpenAI: GPT-4o" },
    { provider: "openai", model: "gpt-4o-mini", displayName: "OpenAI: GPT-4o-Mini" }
];

interface ChatInputFormProps {
    activeAgent: "MaxHermes" | "MaxClaw";
    currentActiveModelName: string;
    realProviders: ProviderInfo[];
    handleSwitchProvider: (providerKey: string, modelName: string) => void;
    isGenerating: boolean;
    stopGeneration: () => void;
    availableCommands: CommandInfo[];
    onSendMessage: (
        prompt: string,
        useReformulate: boolean,
        useHeadless: boolean,
        pastedImages: string[],
        mode: 'default' | 'thinking' | 'fast',
        model?: string
    ) => void;
}

export const ChatInputForm = React.memo(function ChatInputForm({
    activeAgent,
    currentActiveModelName,
    realProviders,
    handleSwitchProvider,
    isGenerating,
    stopGeneration,
    availableCommands,
    onSendMessage
}: ChatInputFormProps) {
    const [input, setInput] = useState('');
    const [isPaused, setIsPaused] = useState(false);

    const [useReformulate, setUseReformulate] = useState(() => {
        try {
            const saved = localStorage.getItem('bridge_use_reformulate');
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    const [useHeadless, setUseHeadless] = useState(() => {
        try {
            const saved = localStorage.getItem('bridge_use_headless');
            return saved !== null ? JSON.parse(saved) : true;
        } catch {
            return true;
        }
    });

    const [chatMode, setChatMode] = useState<'default' | 'thinking' | 'fast'>(() => {
        try {
            const saved = localStorage.getItem('bridge_chat_mode');
            return (saved as 'default' | 'thinking' | 'fast') || 'default';
        } catch {
            return 'default';
        }
    });

    const [pastedImages, setPastedImages] = useState<string[]>([]);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showCommandSuggest, setShowCommandSuggest] = useState(false);
    const [filteredSuggests, setFilteredSuggests] = useState<CommandInfo[]>([]);
    const [suggestIndex, setSuggestIndex] = useState(0);

    useEffect(() => {
        localStorage.setItem('bridge_use_reformulate', JSON.stringify(useReformulate));
    }, [useReformulate]);

    useEffect(() => {
        localStorage.setItem('bridge_use_headless', JSON.stringify(useHeadless));
    }, [useHeadless]);

    useEffect(() => {
        localStorage.setItem('bridge_chat_mode', chatMode);
    }, [chatMode]);

    // Tự động kiểm tra và reset trạng thái tạm dừng khi tiến trình AI dừng hoạt động
    useEffect(() => {
        if (!isGenerating) {
            setIsPaused(false);
            fetch('/api/agent/resume', { method: 'POST' }).catch(() => { });
        }
    }, [isGenerating]);

    const enabledModelOptions = useMemo(() => {
        const enabledKeys = new Set(realProviders.map(p => p.key));
        return ALL_MODEL_OPTIONS.filter(opt => enabledKeys.has(opt.provider));
    }, [realProviders]);

    const handleSelectModelOption = (providerKey: string, modelName: string) => {
        handleSwitchProvider(providerKey, modelName);
        setShowModelDropdown(false);

        let nextMode: 'default' | 'thinking' | 'fast' = 'default';
        const lowerModel = modelName.toLowerCase();
        if (lowerModel.includes('max') || lowerModel.includes('reasoner')) {
            nextMode = 'thinking';
        } else if (lowerModel.includes('plus') || lowerModel.includes('chat') || lowerModel.includes('mini') || lowerModel.includes('flash')) {
            nextMode = 'fast';
        }
        setChatMode(nextMode);
    };

    const handleTogglePause = async () => {
        const endpoint = isPaused ? '/api/agent/resume' : '/api/agent/pause';
        try {
            const res = await fetch(endpoint, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setIsPaused(data.isPaused);
            }
        } catch (err) {
            console.error("Lỗi khi thay đổi trạng thái tạm dừng:", err);
        }
    };

    const handleInputChange = (val: string) => {
        setInput(val);
        if (val.startsWith('/')) {
            const query = val.toLowerCase();
            const filtered = availableCommands.filter(c =>
                c.cmd.startsWith(query) || (c.alias && c.alias.startsWith(query))
            );
            setFilteredSuggests(filtered);
            setShowCommandSuggest(filtered.length > 0);
        } else {
            setShowCommandSuggest(false);
        }
    };

    const handleCommandSelect = (cmd: string) => {
        setInput(cmd + " ");
        setShowCommandSuggest(false);
    };

    const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
        e.preventDefault();
        if ((!input.trim() && pastedImages.length === 0) || isGenerating) return;

        const matchedOpt = enabledModelOptions.find(opt => opt.model === currentActiveModelName);
        const modelPayload = matchedOpt ? `${matchedOpt.provider}:${matchedOpt.model}` : undefined;

        onSendMessage(input, useReformulate, useHeadless, pastedImages, chatMode, modelPayload);
        setInput('');
        setPastedImages([]);
        setShowCommandSuggest(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCommandSuggest && filteredSuggests.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestIndex((prev) => (prev + 1) % filteredSuggests.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestIndex((prev) => (prev - 1 + filteredSuggests.length) % filteredSuggests.length);
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                handleCommandSelect(filteredSuggests[suggestIndex].cmd);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit(e);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowCommandSuggest(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        if (event.target?.result) {
                            const base64Data = event.target.result as string;
                            setPastedImages((prev) => [...prev, base64Data]);
                        }
                    };
                    reader.readAsDataURL(file);
                    e.preventDefault();
                }
            }
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-zinc-200 bg-zinc-50/50 select-none relative"
            style={{ transform: 'translateZ(0)', willChange: 'transform' }}
        >
            <AnimatePresence>
                {showCommandSuggest && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-zinc-200 rounded-xl shadow-xl max-h-40 overflow-y-auto z-50 p-1"
                    >
                        <div className="px-2 py-0.5 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Slash Commands</div>
                        {filteredSuggests.map((c, idx) => (
                            <button
                                key={c.cmd}
                                type="button"
                                onClick={() => handleCommandSelect(c.cmd)}
                                className={`w-full text-left px-2 py-1 rounded-md flex items-center justify-between text-[11px] cursor-pointer font-semibold transition-colors ${idx === suggestIndex
                                    ? "bg-blue-50 text-blue-700 font-bold"
                                    : "text-zinc-750 hover:bg-zinc-50"
                                    }`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-blue-600 font-mono font-bold">{c.cmd}</span>
                                    {c.alias && <span className="text-[9px] text-zinc-400 font-mono">({c.alias})</span>}
                                </div>
                                <span className="text-[9px] text-zinc-500">{c.desc}</span>
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {pastedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5 animate-fade-in max-w-full text-left">
                    {pastedImages.map((img, index) => (
                        <div key={index} className="relative inline-block group">
                            <img
                                src={img}
                                alt={`Pasted Thumbnail ${index}`}
                                className="max-h-20 max-w-[120px] rounded-lg border border-zinc-200 shadow-md object-contain bg-zinc-50 p-0.5"
                            />
                            <button
                                type="button"
                                onClick={() => setPastedImages((prev) => prev.filter((_, idx) => idx !== index))}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[9px] font-bold shadow-md transition-all cursor-pointer border-none"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 flex flex-col focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-300/30 transition-[border-color,box-shadow] duration-200 shadow-sm relative">
                <textarea
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    placeholder="Nhập tin nhắn... (dùng / để xem phím tắt, dán nhiều ảnh từ clipboard)"
                    rows={3}
                    className="w-full bg-transparent border-none outline-none resize-y text-[15px] text-zinc-800 placeholder-zinc-400 p-1 leading-relaxed mb-0.5 min-h-[72px] max-h-48"
                />

                <div className="flex justify-between items-center border-t border-zinc-200/60 pt-2 mt-1 flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            className="w-8 h-8 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 flex items-center justify-center font-semibold text-sm cursor-pointer transition-colors shadow-xs animate-none"
                            title="Thêm tệp đính kèm"
                        >
                            +
                        </button>

                        <div className="relative inline-block text-left">
                            <button
                                type="button"
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center h-8 gap-1.5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-lg px-2.5 shadow-xs transition-[border-color,background-color] duration-200 cursor-pointer select-none"
                            >
                                <span className="text-xs">
                                    {activeAgent === "MaxHermes" ? "🤖" : "👾"}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-700 font-mono">
                                    {activeAgent}
                                </span>
                                <span className="text-[9px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-1.5 py-0.5">
                                    {currentActiveModelName}
                                </span>
                                <span className="text-[8px] text-zinc-400">▼</span>
                            </button>

                            {showModelDropdown && (
                                <div className="absolute bottom-full left-0 mb-1.5 w-52 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 z-50 text-[11px] font-semibold text-zinc-700 max-h-60 overflow-y-auto">
                                    <div className="px-2 py-0.5 text-[7px] uppercase tracking-wider text-zinc-400">Chọn AI & Model</div>
                                    {enabledModelOptions.map((opt) => {
                                        const isSelected = currentActiveModelName === opt.model;
                                        return (
                                            <button
                                                key={`${opt.provider}-${opt.model}`}
                                                type="button"
                                                onClick={() => handleSelectModelOption(opt.provider, opt.model)}
                                                className={`w-full text-left px-2 py-1 hover:bg-zinc-50 flex items-center justify-between cursor-pointer ${isSelected ? "text-blue-600 bg-blue-50 font-bold" : "text-zinc-655"
                                                    }`}
                                            >
                                                <span>{opt.displayName}</span>
                                                {isSelected && <span className="text-[8px]">✓</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setUseReformulate(!useReformulate)}
                            className={`h-8 px-2.5 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer select-none flex items-center justify-center ${useReformulate
                                ? "bg-blue-50 border-blue-200 text-blue-600"
                                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Tự động tối ưu hóa câu hỏi"
                        >
                            ✨ Ref: {useReformulate ? "ON" : "OFF"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setUseHeadless(!useHeadless)}
                            className={`h-8 px-2.5 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer select-none flex items-center justify-center ${useHeadless
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Chạy trình duyệt ẩn danh không giao diện"
                        >
                            ⚡ Headless: {useHeadless ? "ON" : "OFF"}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setChatMode(prev => {
                                    if (prev === 'default') return 'thinking';
                                    if (prev === 'thinking') return 'fast';
                                    return 'default';
                                });
                            }}
                            className={`h-8 px-2.5 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer select-none flex items-center justify-center ${chatMode === 'thinking'
                                ? "bg-purple-50 border-purple-200 text-purple-600"
                                : chatMode === 'fast'
                                    ? "bg-amber-50 border-amber-200 text-amber-600"
                                    : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Chế độ hoạt động của Agent"
                        >
                            {chatMode === 'thinking' ? "🧠 Mode: Thinking" : chatMode === 'fast' ? "⚡ Mode: Fast" : "🤖 Mode: Auto"}
                        </button>

                        {/* ⏸️ NÚT ĐIỀU KHIỂN PAUSE/RESUME KHI ĐANG GENERATING */}
                        {isGenerating && (
                            <button
                                type="button"
                                onClick={handleTogglePause}
                                className={`h-8 px-2.5 rounded-lg text-[10px] font-bold font-mono border transition-all cursor-pointer select-none flex items-center justify-center ${isPaused
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-600 animate-pulse font-extrabold"
                                    : "bg-amber-50 border-amber-300 text-amber-600"
                                    }`}
                                title={isPaused ? "Bấm để tiếp tục chạy" : "Tạm dừng xử lý (Breakpoint trước Tool Call)"}
                            >
                                {isPaused ? "▶ Resume" : "⏸ Pause"}
                            </button>
                        )}
                    </div>

                    <button
                        type="submit"
                        onClick={isGenerating ? stopGeneration : undefined}
                        className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm p-0 cursor-pointer shadow-sm transition-transform duration-200 active:scale-95 hover:scale-105 ${isGenerating ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                            }`}
                        title={isGenerating ? "Dừng phản hồi" : "Gửi tin nhắn"}
                    >
                        {isGenerating ? '■' : '↑'}
                    </button>
                </div>
            </div>
        </form>
    );
});