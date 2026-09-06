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
  '&.cm-editor[aria-readonly="true"] .cm-content': { backgroundColor: 'var(--color-code-bg)' },
  '&.cm-editor[aria-readonly="true"]': { backgroundColor: 'var(--color-code-bg)' },
});

/**
 * Replace a <textarea> with a CodeMirror editor. The textarea is hidden (not
 * removed) so its <label for> keeps working via aria-labelledby, and forms or
 * tests that fall back to it still function.
 */
export function mountEditor(textarea: HTMLTextAreaElement, options: EditorOptions = {}): Editor {
  const languageCompartment = new Compartment();
  const readOnlyCompartment = new Compartment();
  const wrapCompartment = new Compartment();

  const label = textarea.id ? document.querySelector(`label[for="${textarea.id}"]`) : null;
  if (label && !label.id) label.id = `${textarea.id}-label`;

  const wrapper = document.createElement('div');
  wrapper.className = 'editor';
  textarea.insertAdjacentElement('afterend', wrapper);
  textarea.hidden = true;
  textarea.tabIndex = -1;

  const view = new EditorView({
    parent: wrapper,
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
        EditorView.contentAttributes.of({
          'aria-labelledby': label?.id ?? '',
          'aria-readonly': String(options.readOnly ?? false),
          'data-editor-for': textarea.id,
        }),
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
  view.dom.setAttribute('aria-readonly', String(options.readOnly ?? false));

  return {
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
      view.dispatch({
        effects: readOnlyCompartment.reconfigure([
          EditorState.readOnly.of(readOnly),
          EditorView.editable.of(!readOnly),
        ]),
      });
      view.dom.setAttribute('aria-readonly', String(readOnly));
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
      view.destroy();
      wrapper.remove();
      textarea.hidden = false;
      textarea.tabIndex = 0;
    },
  };
}

/**
 * Convert a JSON.parse error message into a document offset. Chromium/Node
 * report "at position N" or "(line L column C)"; Firefox reports "line L column C".
 */
export function parseErrorOffset(message: string, source: string): number | undefined {
  const pos = /position (\d+)/.exec(message);
  if (pos) return Number(pos[1]);
  const lc = /line (\d+) column (\d+)/i.exec(message);
  if (lc) {
    const line = Number(lc[1]);
    const col = Number(lc[2]);
    const lines = source.split('\n');
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) offset += (lines[i]?.length ?? 0) + 1;
    return offset + col - 1;
  }
  return undefined;
}
