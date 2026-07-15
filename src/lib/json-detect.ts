export interface JsonDetectResult {
  /** 原始文本可直接填入 JSON 格式化器 */
  formatterInput: string;
  /** 外层是否为 JSON 字符串（如 "{\"a\":1}"） */
  isStringWrapped: boolean;
}

/** 检测文本是否为 JSON 对象/数组，或包裹 JSON 的字符串 */
export function detectJsonText(text: string | null | undefined): JsonDetectResult | null {
  if (!text?.trim()) return null;

  const trimmed = text.trim();

  try {
    const parsed = JSON.parse(trimmed);

    if (typeof parsed === 'string') {
      try {
        const inner = JSON.parse(parsed);
        if (typeof inner === 'object' && inner !== null) {
          return { formatterInput: parsed, isStringWrapped: true };
        }
      } catch {
        return null;
      }
      return null;
    }

    if (typeof parsed === 'object' && parsed !== null) {
      return { formatterInput: trimmed, isStringWrapped: false };
    }

    return null;
  } catch {
    return null;
  }
}
