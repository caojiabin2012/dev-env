const MODIFIERS = new Set(['Ctrl', 'Alt', 'Shift', 'Meta']);

const KEY_BEFORE_ONE = 'Backquote';

const CODE_TO_KEY: Record<string, string> = {
  Backquote: KEY_BEFORE_ONE,
  Minus: 'Minus',
  Equal: 'Equal',
  BracketLeft: 'BracketLeft',
  BracketRight: 'BracketRight',
  Backslash: 'Backslash',
  Semicolon: 'Semicolon',
  Quote: 'Quote',
  Comma: 'Comma',
  Period: 'Period',
  Slash: 'Slash',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Escape: 'Escape',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Numpad0: 'Numpad0',
  Numpad1: 'Numpad1',
  Numpad2: 'Numpad2',
  Numpad3: 'Numpad3',
  Numpad4: 'Numpad4',
  Numpad5: 'Numpad5',
  Numpad6: 'Numpad6',
  Numpad7: 'Numpad7',
  Numpad8: 'Numpad8',
  Numpad9: 'Numpad9',
  NumpadAdd: 'NumpadAdd',
  NumpadSubtract: 'NumpadSubtract',
  NumpadMultiply: 'NumpadMultiply',
  NumpadDivide: 'NumpadDivide',
  NumpadDecimal: 'NumpadDecimal',
  NumpadEnter: 'NumpadEnter',
};

const SPECIAL_KEYS = new Set(Object.values(CODE_TO_KEY));

const KEY_DISPLAY: Record<string, string> = {
  Backquote: '~',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Escape: 'Esc',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

const KEYS_BEFORE_ONE = new Set(['`', '~', '·', '˙', '‵']);

function codeToKey(code: string): string | null {
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  if (/^F\d+$/.test(code)) return code;
  return CODE_TO_KEY[code] ?? null;
}

function eventToKey(e: KeyboardEvent): string | null {
  const fromCode = codeToKey(e.code);
  if (fromCode) return fromCode;
  if (KEYS_BEFORE_ONE.has(e.key)) return KEY_BEFORE_ONE;
  return null;
}

export function keyboardEventToShortcut(e: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  const key = eventToKey(e);
  if (!key || ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    return null;
  }

  parts.push(key);
  return parts.length > 1 ? parts.join('+') : null;
}

export function isValidShortcut(shortcut: string): boolean {
  const parts = shortcut.split('+');
  if (parts.length < 2) return false;

  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  if (!mods.every((m) => MODIFIERS.has(m))) return false;
  if (/^[A-Z0-9]$/.test(key)) return true;
  if (SPECIAL_KEYS.has(key)) return true;
  if (/^F\d+$/.test(key)) return true;
  return false;
}

export function formatShortcutDisplay(shortcut: string): string {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const displayKey = KEY_DISPLAY[key] ?? key;
  return [...mods, displayKey].join('+');
}
