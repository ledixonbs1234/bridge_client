// filepath: ridge_client/src/components/terminal/TimelineTextBlock.tsx
import * as React from "react";
import { useMemo } from "react";
import { marked } from "marked";
import { MermaidRenderer } from "../MermaidRenderer";

interface TimelineTextBlockProps {
    content: string;
    theme?: 'light' | 'dark'; // Thêm cấu hình hỗ trợ theme
}

interface ParsedPart {
    type: string;
    content: string;
    html?: string;
}

function parseContentAndMermaid(content: string) {
    const regex = /```mermaid\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const textBefore = content.substring(lastIndex, match.index);
        if (textBefore.trim()) {
            parts.push({ type: 'markdown', content: textBefore });
        }
        parts.push({ type: 'mermaid', content: match[1] });
        lastIndex = regex.lastIndex;
    }

    const textAfter = content.substring(lastIndex);
    if (textAfter.trim() || parts.length === 0) {
        parts.push({ type: 'markdown', content: textAfter });
    }

    return parts;
}

export const TimelineTextBlock = React.memo(function TimelineTextBlock({ content, theme = 'light' }: TimelineTextBlockProps) {
    const cleanContent = useMemo(() => {
        return content
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
            .trim();
    }, [content]);

    const parsedParts = useMemo<ParsedPart[]>(() => {
        const rawParts = parseContentAndMermaid(cleanContent);
        return rawParts.map((part) => {
            if (part.type === 'markdown') {
                return {
                    ...part,
                    html: marked.parse(part.content) as string
                };
            }
            return part;
        });
    }, [cleanContent]);

    // Chọn class CSS markdown bám sát theme hiện hành
    const bodyClass = theme === 'dark' ? 'markdown-body-dark' : 'markdown-body-light';

    return (
        <div className="space-y-3.5 text-left">
            {parsedParts.map((part, partIdx) => {
                if (part.type === 'mermaid') {
                    return (
                        <div key={partIdx} className="my-1.5">
                            <MermaidRenderer code={part.content} />
                        </div>
                    );
                }
                return (
                    <div
                        key={partIdx}
                        className={`${bodyClass} text-left leading-relaxed text-[15px] select-text`}
                        dangerouslySetInnerHTML={{ __html: part.html || '' }}
                    />
                );
            })}
        </div>
    );
});