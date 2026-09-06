/**
 * CodeMirror 6 wrapper. Tools render a plain <textarea> (works without JS,
 * indexable, labelled) and call `mountEditor()` to upgrade it in place.
 *
 * Everything here is loaded lazily so the shared shell bundle stays tiny; only
 * tool pages that call `mountEditor` pay for CodeMirror (~150 KB, cached).
 */
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { type Diagnostic, lintGutter, setDiagnostics } from '@codemirror/lint';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  rectangularSelection,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';

export type EditorLanguage = 'json' | 'yaml' | 'xml' | 'text';

export interface EditorOptions {
  language?: EditorLanguage;
  readOnly?: boolean;
  placeholder?: string;
  lineWrapping?: boolean;
  /** Debounced by the caller if needed; fires on every document change. */
  onChange?: (value: string) => void;
}

export interface EditorDiagnostic {
  from: number;
  to: number;
  message: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface Editor {
  readonly view: EditorView;
  getValue(): string;
  setValue(value: string): void;
  setLanguage(language: EditorLanguage): void;
  setReadOnly(readOnly: boolean): void;
  setDiagnostics(diagnostics: EditorDiagnostic[]): void;
  /** Scroll to and select a document offset (e.g. a parse error). */
  revealOffset(offset: number): void;
  focus(): void;
  destroy(): void;
}

const languageExtensions: Record<EditorLanguage, () => Extension> = {
  json: () => json(),
  yaml: () => yaml(),
  xml: () => xml(),
  text: () => [],
};

/** Colours come from the design tokens so light/dark switching is free. */
const theme = EditorView.theme({
  '&': {
    fontSize: 'var(--text-sm)',
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    minHeight: 'var(--editor-min-height, 14rem)',
    maxHeight: 'var(--editor-max-height, 70dvh)',
  },
  '&.cm-focused': {
    outline: '2px solid var(--color-focus)',
    outlineOffset: '0',
    borderColor: 'var(--color-accent)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.55',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: 'var(--space-2) 0',
    caretColor: 'var(--color-text)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--color-bg-subtle)',
    color: 'var(--color-text-faint)',
    borderRight: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--color-accent) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-bg-muted)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent) !important',
  },
  '.cm-cursor': { borderLeftColor: 'var(--color-text)' },
  '.cm-placeholder': { color: 'var(--color-text-faint)', fontStyle: 'normal' },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--color-danger)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-surface-raised)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
  },
  '.cm-matchingBracket': { backgroundColor: 'var(--color-accent-soft)', outline: 'none' },
  '&[data-readonly="true"] .cm-content': { backgroundColor: 'var(--color-code-bg)' },
  '&[data-readonly="true"]': { backgroundColor: 'var(--color-code-bg)' },
});

/**
 * Replace a <textarea> with a CodeMirror editor. The textarea is hidden (not
 * removed) so its <label for> keeps working via aria-labelledby, and forms or
 * tests that fall back to it still function.
 */
export function mountEditor(
  textarea: HTMLTextAreaElement,
  initialOptions: EditorOptions = {},
): Editor {
  let options = initialOptions;
  const languageCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  const wrapCompartment = new Compartment();

  const attrsCompartment = new Compartment();

  const label = textarea.id ? document.querySelector(`label[for="${textarea.id}"]`) : null;

  // The editor lives in a shadow root: CodeMirror then injects its styles as
  // adopted stylesheets instead of <style> tags, which the strict CSP blocks.
  // CSS custom properties inherit through the boundary, so theming still works.
  const wrapper = document.createElement('div');
  wrapper.className = 'editor';
  textarea.insertAdjacentElement('afterend', wrapper);
  textarea.hidden = true;
  textarea.tabIndex = -1;
  const shadow = wrapper.attachShadow({ mode: 'open' });

  // aria-labelledby cannot cross the shadow boundary, so mirror the label text.
  const contentAttrs = (): Record<string, string> => ({
    'aria-label': label?.textContent?.trim() || textarea.getAttribute('aria-label') || 'Editor',
    'aria-readonly': String(options.readOnly ?? false),
    'data-editor-for': textarea.id,
  });

  const view = new EditorView({
    parent: shadow,
    root: shadow,
    state: EditorState.create({
      doc: textarea.value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        lintGutter(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        theme,
        languageCompartment.of(languageExtensions[options.language ?? 'text']()),
        readOnlyCompartment.of([
          EditorState.readOnly.of(options.readOnly ?? false),
          EditorView.editable.of(!(options.readOnly ?? false)),
        ]),
        wrapCompartment.of(options.lineWrapping === false ? [] : EditorView.lineWrapping),
        placeholderExt(options.placeholder ?? textarea.placeholder ?? ''),
        attrsCompartment.of(EditorView.contentAttributes.of(contentAttrs())),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const value = update.state.doc.toString();
            textarea.value = value;
            options.onChange?.(value);
          }
        }),
      ],
    }),
  });
  view.dom.setAttribute('data-readonly', String(options.readOnly ?? false));

  // Keep the accessible name in sync when a tool renames its label (e.g. on Swap).
  let labelObserver: MutationObserver | undefined;
  if (label) {
    labelObserver = new MutationObserver(() => {
      view.dispatch({
        effects: attrsCompartment.reconfigure(EditorView.contentAttributes.of(contentAttrs())),
      });
    });
    labelObserver.observe(label, { childList: true, characterData: true, subtree: true });
  }

  // Clicking the <label> should focus the editor like it would the textarea.
  label?.addEventListener('click', (e) => {
    e.preventDefault();
    view.focus();
  });

  const api: Editor = {
    view,
    getValue: () => view.state.doc.toString(),
    setValue(value) {
      if (value === view.state.doc.toString()) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      textarea.value = value;
    },
    setLanguage(language) {
      view.dispatch({ effects: languageCompartment.reconfigure(languageExtensions[language]()) });
    },
    setReadOnly(readOnly) {
      options = { ...options, readOnly };
      view.dispatch({
        effects: [
          readOnlyCompartment.reconfigure([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
          attrsCompartment.reconfigure(EditorView.contentAttributes.of(contentAttrs())),
        ],
      });
      view.dom.setAttribute('data-readonly', String(readOnly));
    },
    setDiagnostics(diagnostics) {
      const max = view.state.doc.length;
      const clamped: Diagnostic[] = diagnostics.map((d) => ({
        from: Math.min(Math.max(0, d.from), max),
        to: Math.min(Math.max(d.from, d.to), max),
        message: d.message,
        severity: d.severity ?? 'error',
      }));
      view.dispatch(setDiagnostics(view.state, clamped));
    },
    revealOffset(offset) {
      const pos = Math.min(Math.max(0, offset), view.state.doc.length);
      view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      view.focus();
    },
    focus: () => view.focus(),
    destroy() {
      labelObserver?.disconnect();
      view.destroy();
      wrapper.remove();
      textarea.hidden = false;
      textarea.tabIndex = 0;
    },
  };

  // Expose the API on the editor element so browser tests can set content
  // without simulating keystrokes into a contenteditable (which mangles whitespace).
  (view.dom as HTMLElement & { cuisdevEditor?: Editor }).cuisdevEditor = api;
  (wrapper as HTMLElement & { cuisdevEditor?: Editor }).cuisdevEditor = api;
  return api;
}

export { parseErrorOffset } from './json-errors';
