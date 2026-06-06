import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css"; // Nạp giao diện tối của Github cho khối Code

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sử dụng highlight.js để biên dịch chuỗi code sang chuỗi HTML có chứa các thẻ span được tô màu
 */
export function highlightCodeLine(code: string, language: string = 'typescript'): string {
  try {
    // Tự động escape HTML và gán các class tô màu của highlight.js
    return hljs.highlight(code, { language }).value;
  } catch (e) {
    return hljs.highlightAuto(code).value;
  }
}