/** Tiny DOM helpers shared by tool clients. Zero dependencies. */

/** Query a required element, throwing a helpful error if missing. */
export function $<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
}

export function $$<T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A): void => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Show a transient success state on a button (e.g. "Copied!"). */
export function flashButton(button: HTMLButtonElement, label = 'Copied!', ms = 1500): void {
  const original = button.dataset.label ?? button.textContent ?? '';
  button.dataset.label = original;
  const text = button.querySelector<HTMLElement>('[data-label]') ?? button;
  text.textContent = label;
  button.dataset.state = 'success';
  window.setTimeout(() => {
    text.textContent = original;
    delete button.dataset.state;
  }, ms);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string, type = 'text/plain'): void {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}

/** Announce a status message. `tone` drives colour via [data-tone]. */
export function setStatus(
  el: HTMLElement,
  message: string,
  tone: 'info' | 'error' | 'success' = 'info',
): void {
  el.textContent = message;
  el.dataset.tone = tone;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[i]}`;
}

/** Wire drag-and-drop of files onto an element. */
export function onFileDrop(
  target: HTMLElement,
  handler: (files: File[]) => void,
  options: { accept?: (file: File) => boolean } = {},
): void {
  const setDragging = (on: boolean) => {
    target.dataset.dragging = on ? 'true' : 'false';
  };
  target.addEventListener('dragenter', (e) => {
    e.preventDefault();
    setDragging(true);
  });
  target.addEventListener('dragover', (e) => {
    e.preventDefault();
    setDragging(true);
  });
  target.addEventListener('dragleave', (e) => {
    if (!target.contains(e.relatedTarget as Node | null)) setDragging(false);
  });
  target.addEventListener('drop', (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files ?? []).filter(options.accept ?? (() => true));
    if (files.length > 0) handler(files);
  });
}
