// filepath: ridge_client/src/components/terminal/StructuredQuestionsForm.tsx
import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "../animate-ui/button";

interface QuestionOption {
    label: string;
    value: string;
    is_default?: boolean;
}

interface QuestionItem {
    id: string;
    question: string;
    type: "select" | "multi_select" | "text";
    options?: QuestionOption[];
    allow_custom?: boolean;
}

interface StructuredQuestionsFormProps {
    data: {
        explanation: string;
        questions: any;
    };
    onSubmit: (answers: Record<string, any>) => void;
    onCancel: () => void;
}

export const StructuredQuestionsForm = React.memo(function StructuredQuestionsForm({ data, onSubmit, onCancel }: StructuredQuestionsFormProps) {
    const questionsArray = useMemo<QuestionItem[]>(() => {
        let q = data.questions;
        if (typeof q === 'string') {
            try {
                q = JSON.parse(q);
            } catch {
                q = [];
            }
        }
        return Array.isArray(q) ? (q as QuestionItem[]) : [];
    }, [data.questions]);

    const [formState, setFormState] = useState<Record<string, any>>(() => {
        const initial: Record<string, any> = {};
        questionsArray.forEach((q: QuestionItem) => {
            if (q.type === 'select') {
                const defaultOpt = q.options?.find((o: QuestionOption) => o.is_default);
                initial[q.id] = defaultOpt ? defaultOpt.value : (q.options?.[0]?.value || '');
            } else if (q.type === 'multi_select') {
                initial[q.id] = q.options?.filter((o: QuestionOption) => o.is_default).map((o: QuestionOption) => o.value) || [];
            } else {
                initial[q.id] = '';
            }
        });
        return initial;
    });

    const [customValues, setCustomValues] = useState<Record<string, string>>({});
    const [useCustom, setUseCustom] = useState<Record<string, boolean>>({});

    const handleToggleMultiSelect = useCallback((qId: string, val: string) => {
        setFormState(prev => {
            const current = prev[qId] || [];
            const next = current.includes(val)
                ? current.filter((v: string) => v !== val)
                : [...current, val];
            return { ...prev, [qId]: next };
        });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalAnswers: Record<string, any> = {};
        questionsArray.forEach((q: QuestionItem) => {
            if (q.type === 'select') {
                finalAnswers[q.id] = useCustom[q.id] ? (customValues[q.id] || '') : formState[q.id];
            } else if (q.type === 'multi_select') {
                const selected = [...(formState[q.id] || [])];
                if (q.allow_custom && useCustom[q.id] && customValues[q.id]) {
                    selected.push(customValues[q.id]);
                }
                finalAnswers[q.id] = selected;
            } else {
                finalAnswers[q.id] = formState[q.id];
            }
        });
        onSubmit(finalAnswers);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 shadow-inner">
                <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-0.5">💡 GIẢI THÍCH NGỮ CẢNH CỦA AGENT</span>
                <p className="text-[11px] text-zinc-700 leading-relaxed font-semibold">{data.explanation}</p>
            </div>

            <div className="space-y-4 divide-y divide-zinc-100 max-h-[300px] overflow-y-auto pr-1">
                {questionsArray.map((q: QuestionItem, idx: number) => (
                    <div key={q.id} className={`pt-3.5 ${idx === 0 ? 'pt-0 border-none' : ''}`}>
                        <label className="text-[11px] font-bold text-zinc-800 block mb-2">
                            <span className="text-blue-600 font-extrabold mr-1.5">{idx + 1}.</span>
                            {q.question}
                        </label>

                        {q.type === 'select' && (
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                    {q.options?.map((opt: QuestionOption) => {
                                        const isSelected = formState[q.id] === opt.value && !useCustom[q.id];
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => {
                                                    setUseCustom(prev => ({ ...prev, [q.id]: false }));
                                                    setFormState(prev => ({ ...prev, [q.id]: opt.value }));
                                                }}
                                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                                    }`}
                                            >
                                                {opt.label} {opt.is_default && <span className={isSelected ? 'text-blue-200' : 'text-blue-500'}>★</span>}
                                            </button>
                                        );
                                    })}
                                    {q.allow_custom && (
                                        <button
                                            type="button"
                                            onClick={() => setUseCustom(prev => ({ ...prev, [q.id]: true }))}
                                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${useCustom[q.id]
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                                                }`}
                                        >
                                            ✏️ Tự nhập...
                                        </button>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {useCustom[q.id] && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <input
                                                type="text"
                                                required
                                                value={customValues[q.id] || ''}
                                                onChange={(e) => setCustomValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                placeholder="Nhập phương án tự định nghĩa của bạn..."
                                                className="w-full mt-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs"
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {q.type === 'multi_select' && (
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                    {q.options?.map((opt: QuestionOption) => {
                                        const isSelected = formState[q.id]?.includes(opt.value);
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleToggleMultiSelect(q.id, opt.value)}
                                                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${isSelected
                                                    ? 'bg-blue-600 border-blue-600 text-white'
                                                    : 'bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50'
                                                    }`}
                                            >
                                                {isSelected ? '✓ ' : ''}{opt.label} {opt.is_default && <span className={isSelected ? 'text-blue-200' : 'text-blue-500'}>★</span>}
                                            </button>
                                        );
                                    })}
                                    {q.allow_custom && (
                                        <button
                                            type="button"
                                            onClick={() => setUseCustom(prev => ({ ...prev, [q.id]: !prev[q.id] }))}
                                            className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${useCustom[q.id]
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white border-zinc-200 text-zinc-655 hover:bg-zinc-50'
                                                }`}
                                        >
                                            ✏️ Ý kiến bổ sung...
                                        </button>
                                    )}
                                </div>

                                <AnimatePresence>
                                    {useCustom[q.id] && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <input
                                                type="text"
                                                required
                                                value={customValues[q.id] || ''}
                                                onChange={(e) => setCustomValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                placeholder="Nhập phương án bổ sung..."
                                                className="w-full mt-1.5 px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs"
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {q.type === 'text' && (
                            <textarea
                                required
                                value={formState[q.id] || ''}
                                onChange={(e) => setFormState(prev => ({ ...prev, [q.id]: e.target.value }))}
                                placeholder="Nhập câu trả lời chi tiết của bạn..."
                                rows={2}
                                className="w-full px-2.5 py-2 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-800 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500/20 outline-none shadow-xs resize-none"
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-1.5 justify-end border-t border-zinc-150 pt-3 mt-1">
                <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    className="text-zinc-655 border-zinc-200 hover:bg-zinc-50 text-[10px] h-7 px-2.5 cursor-pointer"
                    onClick={onCancel}
                >
                    Từ chối (Hủy bỏ)
                </Button>
                <Button
                    variant="default"
                    size="sm"
                    type="submit"
                    className="text-[10px] h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer border-none font-semibold"
                >
                    ✓ Xác nhận hoàn tất
                </Button>
            </div>
        </form>
    );
});