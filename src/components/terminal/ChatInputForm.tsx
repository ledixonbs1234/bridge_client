// filepath: ridge_client/src/components/terminal/ChatInputForm.tsx
import * as React from "react";
import { useState, useEffect, useCallback } from "react";
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

interface ChatInputFormProps {
    activeAgent: "MaxHermes" | "MaxClaw";
    currentActiveModelName: string;
    realProviders: ProviderInfo[];
    handleSwitchProvider: (providerKey: string, providerName: string) => void;
    isGenerating: boolean;
    stopGeneration: () => void;
    availableCommands: CommandInfo[];
    onSendMessage: (
        prompt: string,
        useReformulate: boolean,
        useHeadless: boolean,
        pastedImages: string[]
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
        setSuggestIndex(0);
    }, [filteredSuggests]);

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

        onSendMessage(input, useReformulate, useHeadless, pastedImages);
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
            style={{
                transform: 'translateZ(0)',
                willChange: 'transform',
                contain: 'content',
            }}
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
                                title="Xóa hình ảnh này"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div
                className="bg-zinc-50 border border-zinc-200 rounded-xl p-2 flex flex-col focus-within:border-zinc-300 focus-within:ring-1 focus-within:ring-zinc-300/30 transition-[border-color,box-shadow] duration-200 shadow-sm relative"
                style={{ contain: 'content' }}
            >
                <textarea
                    value={input}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    placeholder="Nhập tin nhắn... (dùng / để xem phím tắt, dán nhiều ảnh từ clipboard)"
                    rows={1}
                    className="w-full bg-transparent border-none outline-none resize-none text-[15px] text-zinc-800 placeholder-zinc-400 p-1 leading-relaxed mb-0.5 min-h-[24px] max-h-32"
                />

                <div className="flex justify-between items-center border-t border-zinc-200/60 pt-2 mt-1 flex-wrap gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            className="w-6 h-6 rounded-md border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-800 flex items-center justify-center font-semibold text-xs cursor-pointer transition-colors shadow-xs animate-none"
                            title="Thêm tệp đính kèm"
                        >
                            +
                        </button>

                        <div className="relative inline-block text-left">
                            <button
                                type="button"
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="flex items-center gap-1 bg-white border border-zinc-200 hover:border-zinc-300 rounded-md px-2 py-0.5 shadow-xs transition-[border-color,background-color] duration-200 cursor-pointer select-none"
                            >
                                <span className="text-[10px]">
                                    {activeAgent === "MaxHermes" ? "🤖" : "👾"}
                                </span>
                                <span className="text-[9px] font-bold text-zinc-700 font-mono">
                                    {activeAgent}
                                </span>
                                <span className="text-[8px] font-mono font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded px-1">
                                    {currentActiveModelName}
                                </span>
                                <span className="text-[7px] text-zinc-400">▼</span>
                            </button>

                            {showModelDropdown && (
                                <div className="absolute bottom-full left-0 mb-1.5 w-48 bg-white border border-zinc-200 rounded-lg shadow-xl py-1 z-50 text-[11px] font-semibold text-zinc-700">
                                    <div className="px-2 py-0.5 text-[7px] uppercase tracking-wider text-zinc-400">Nhà cung cấp</div>
                                    {realProviders.map((p) => (
                                        <button
                                            key={p.key}
                                            type="button"
                                            onClick={() => {
                                                handleSwitchProvider(p.key, p.name);
                                                setShowModelDropdown(false);
                                            }}
                                            className={`w-full text-left px-2 py-1 hover:bg-zinc-50 flex items-center justify-between cursor-pointer ${currentActiveModelName === p.name ? "text-blue-600 bg-blue-50 font-bold" : "text-zinc-650"
                                                }`}
                                        >
                                            <span>{p.name}</span>
                                            {currentActiveModelName === p.name && <span className="text-[8px]">✓</span>}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setUseReformulate(!useReformulate)}
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border transition-all cursor-pointer select-none ${useReformulate
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
                            className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border transition-all cursor-pointer select-none ${useHeadless
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                                : "bg-white border-zinc-200 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50"
                                }`}
                            title="Chạy trình duyệt ẩn danh không giao diện"
                        >
                            ⚡ Headless: {useHeadless ? "ON" : "OFF"}
                        </button>
                    </div>

                    <button
                        type="submit"
                        onClick={isGenerating ? stopGeneration : undefined}
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-white font-bold p-0 cursor-pointer shadow-sm transition-transform duration-200 active:scale-95 hover:scale-105 ${isGenerating ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
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