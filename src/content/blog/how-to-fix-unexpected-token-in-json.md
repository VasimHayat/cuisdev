---
title: 'How to fix "Unexpected token" errors in JSON'
description: 'The "Unexpected token" error means your JSON breaks a grammar rule. Here are the six mistakes behind almost every case, and how to fix each one.'
pubDate: 2026-09-06
tags: ['json', 'debugging']
tools: ['json-formatter']
---

`SyntaxError: Unexpected token } in JSON at position 42` is one of the most-searched errors in web development, and one of the least helpful. It tells you the parser hit something it did not expect, but not _why_. JSON has a small, strict grammar, so in practice the error comes from a handful of mistakes. This guide walks through them in the order you should check.

## 1. A trailing comma

```text
{
  "name": "Ada",
  "active": true,
}
```

JavaScript objects allow a comma after the last property. JSON does not. The parser reaches `}` while expecting another `"key"`, and reports an unexpected token at that position. The same applies to arrays (`[1, 2, 3,]`).

**Fix:** delete the comma after the last item. If the JSON is produced by code, look for a template that appends `,` unconditionally.

## 2. Single quotes or unquoted keys

```text
{ 'name': 'Ada', age: 36 }
```

This is a valid JavaScript object literal but invalid JSON. JSON strings — including every object key — must use double quotes. Most parsers report the error at the first `'` or at the bare key.

**Fix:** replace single quotes with double quotes and quote every key. If you are copying from a JavaScript file, the [JSON Formatter's](/tools/json-formatter/) **Fix common mistakes** button does exactly this.

## 3. Comments

```text
{
  // primary contact
  "email": "ada@example.com"
}
```

JSON has no comment syntax. Configuration formats that look like JSON (JSON5, JSONC used by VS Code and TypeScript) allow them, but `JSON.parse` and most APIs reject them.

**Fix:** remove `//` and `/* */` comments, or switch the consumer to a JSONC/JSON5 parser if comments are needed.

## 4. Smart quotes from a document or chat

Copying JSON through Word, Google Docs, Slack or a phone keyboard often replaces `"` with `“` and `”`. They look almost identical in a proportional font and are completely invalid to a parser.

**Fix:** paste the text into a code editor with a monospace font, or run it through a formatter — the curly quotes stand out immediately and the repair tool normalises them.

## 5. Not JSON at all

The most common cause in web apps: the response you are parsing is an HTML error page, an empty string, or `undefined`. `Unexpected token <` almost always means an HTML document (`<!DOCTYPE html>`) came back instead of JSON — a 404 page, a login redirect, or a proxy error.

**Fix:** log the raw response body before parsing, and check `response.ok` and the `Content-Type` header. In the browser's network panel, look at the actual body of the failing request.

## 6. Special values: NaN, Infinity, undefined

Serialising JavaScript data with `JSON.stringify` turns `NaN` and `Infinity` into `null` and drops `undefined` values, but hand-written data or other languages' serialisers sometimes emit them literally. None of them are valid JSON.

**Fix:** use `null`, or a string, for values that cannot be represented.

## Finding the position quickly

Engines report a character offset (`at position 42`) or a line and column. Counting characters by hand is painful. Paste the text into the [JSON Formatter](/tools/json-formatter/): it highlights the exact position, explains the likely cause, and offers a one-click fix for the mechanical mistakes above. Everything runs in your browser, so it is safe to paste real API responses.

## Checklist

1. Trailing comma before `}` or `]`?
2. Single quotes or unquoted keys?
3. Comments?
4. Curly quotes?
5. Is the text actually JSON (not HTML or empty)?
6. `NaN`, `Infinity`, `undefined`?

If all six pass and the error persists, the document is probably truncated — check that the last character is the closing `}` or `]`.
