/** Shared helpers for tool browser tests. */
import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Locate the editable surface behind a labelled input. Works whether the tool
 * uses a plain <textarea> or upgraded it to a CodeMirror editor (the textarea
 * is hidden and the `.cm-content` element carries `data-editor-for`).
 */
export function editorFor(page: Page, textareaId: string): Locator {
  return page.locator(`.cm-content[data-editor-for="${textareaId}"], #${textareaId}:not([hidden])`);
}

/**
 * Replace the editor's contents. For CodeMirror editors we go through the
 * editor API exposed on the wrapper: simulating keystrokes into a
 * contenteditable turns runs of spaces into non-breaking spaces, which would
 * make the test input differ from what a real paste produces.
 */
export async function fillEditor(page: Page, textareaId: string, text: string): Promise<void> {
  const target = editorFor(page, textareaId);
  await expect(target).toBeVisible();
  const isCodeMirror = await target.evaluate((el) => el.classList.contains('cm-content'));
  if (isCodeMirror) {
    await target.click();
    await target.evaluate((el, value) => {
      const wrapper = el.closest('.cm-editor') as
        (HTMLElement & { cuisdevEditor?: { setValue(v: string): void } }) | null;
      if (!wrapper?.cuisdevEditor) throw new Error('editor API not found');
      wrapper.cuisdevEditor.setValue(value);
    }, text);
  } else {
    await target.fill(text);
  }
  await settle(page);
}

/** Tools debounce input (60–80 ms); wait for the output to catch up. */
export async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(200);
}

/** Type into an editor keystroke by keystroke (use for short, space-free input). */
export async function typeInEditor(page: Page, textareaId: string, text: string): Promise<void> {
  const target = editorFor(page, textareaId);
  await target.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(text);
  await settle(page);
}

/** Read the editor's contents (from the mirrored hidden textarea or the textarea itself). */
export async function editorValue(page: Page, textareaId: string): Promise<string> {
  return page.locator(`#${textareaId}`).inputValue();
}

/** Poll until the editor's value matches. */
export async function expectEditorValue(
  page: Page,
  textareaId: string,
  expected: string | RegExp,
): Promise<void> {
  await expect(page.locator(`#${textareaId}`)).toHaveValue(expected);
}

/** Assert the tool's live status region reports an error containing `text`. */
export async function expectError(page: Page, text: string | RegExp): Promise<void> {
  const status = page.getByRole('status').first();
  await expect(status).toContainText(text);
  await expect(status).toHaveAttribute('data-tone', 'error');
}

/**
 * Headless browsers refuse clipboard writes. Stub `navigator.clipboard.writeText`
 * before navigation so Copy buttons resolve, and read back what was copied.
 */
export async function stubClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as Window & { __copied?: string[] };
    w.__copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          w.__copied?.push(text);
          return Promise.resolve();
        },
        readText: () => Promise.resolve(w.__copied?.at(-1) ?? ''),
      },
    });
  });
}

export async function lastCopied(page: Page): Promise<string | undefined> {
  return page.evaluate(() => (window as Window & { __copied?: string[] }).__copied?.at(-1));
}

/**
 * Click a Copy button and return what was copied.
 *
 * The visible "Copied!" flash lasts 1.5 s, which a loaded machine can miss, so
 * the assertion is on the clipboard itself. Call `stubClipboard(page)` before
 * navigating; without it this falls back to waiting for the flash.
 */
export async function clickCopy(page: Page, button: Locator): Promise<string | undefined> {
  const before = await page.evaluate(
    () => (window as Window & { __copied?: string[] }).__copied?.length ?? -1,
  );
  await button.click();

  if (before === -1) {
    await expect(page.getByRole('button', { name: 'Copied!' }).first()).toBeVisible();
    return undefined;
  }

  await page.waitForFunction(
    (n) => ((window as Window & { __copied?: string[] }).__copied?.length ?? 0) > n,
    before,
    { timeout: 10_000 },
  );
  return lastCopied(page);
}

/** Assert the transient success state on a Copy button (best used right after clicking). */
export async function expectCopyFlash(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Copied!' }).first()).toBeVisible();
}
