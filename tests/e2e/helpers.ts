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

/** Replace the editor's contents. */
export async function fillEditor(page: Page, textareaId: string, text: string): Promise<void> {
  const target = editorFor(page, textareaId);
  await expect(target).toBeVisible();
  const isCodeMirror = await target.evaluate((el) => el.classList.contains('cm-content'));
  if (isCodeMirror) {
    await target.click();
    await page.keyboard.press('ControlOrMeta+a');
    // insertText keeps CodeMirror's auto-close-brackets from mangling the input.
    await page.keyboard.insertText(text);
  } else {
    await target.fill(text);
  }
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
