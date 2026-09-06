import { describe, expect, it } from 'vitest';

import { parseErrorOffset } from './editor';

describe('parseErrorOffset', () => {
  it('reads V8 "at position N"', () => {
    expect(parseErrorOffset('Unexpected token } in JSON at position 12', '{}')).toBe(12);
  });

  it('reads "(line L column C)" and converts to an offset', () => {
    const src = '{\n  "a": 1,\n  "b": }';
    // line 3, column 8 → offset of the "}" after "b": "
    expect(parseErrorOffset('Unexpected token "}" (line 3 column 8)', src)).toBe(
      src.indexOf('}', src.indexOf('"b"')),
    );
  });

  it('returns undefined when no position is present', () => {
    expect(parseErrorOffset('Unexpected end of JSON input', '')).toBeUndefined();
  });
});
