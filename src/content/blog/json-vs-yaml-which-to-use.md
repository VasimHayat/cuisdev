---
title: 'JSON vs YAML: which one should you use?'
description: 'JSON and YAML describe the same data with different trade-offs. Compare readability, safety, tooling and comments, then apply one simple rule.'
pubDate: 2026-09-06
tags: ['json', 'yaml', 'config']
tools: ['json-to-yaml', 'json-formatter']
---

JSON and YAML both represent the same shapes: objects, arrays, strings, numbers, booleans and null. In fact, every JSON document is valid YAML. So the choice is not about _what_ you can express but about who reads and writes the file, and how it fails.

## Side by side

```json
{
  "name": "api",
  "replicas": 3,
  "env": { "LOG_LEVEL": "info" },
  "ports": [8080, 8443]
}
```

```yaml
name: api
replicas: 3
env:
  LOG_LEVEL: info
ports:
  - 8080
  - 8443
```

The YAML version has no quotes, braces or commas. That is its whole appeal — and its whole risk.

## Where YAML wins

- **Human editing.** Configuration that people write by hand (CI pipelines, Kubernetes manifests, Docker Compose, Ansible) is easier to read and diff in YAML. Indentation replaces punctuation.
- **Comments.** YAML allows `# comments`. JSON does not, which is a real limitation for config files. Teams often end up inventing `"_comment"` keys.
- **Multi-line strings.** Block scalars (`|` and `>`) hold scripts and long text without escaping.
- **Anchors and aliases.** `&default` / `*default` let you reuse a block, which JSON cannot do.

## Where JSON wins

- **Machine exchange.** Every language has a fast, safe JSON parser in its standard library. APIs, logs, message queues and browser code should use JSON.
- **Predictability.** JSON has one way to write a string. YAML has several, and its implicit typing bites: `country: NO` becomes `false` in YAML 1.1 parsers (the famous "Norway problem"), `version: 1.10` becomes the number `1.1`, and `time: 12:30` may be parsed as sexagesimal `750`. Quote anything that must stay a string.
- **Security.** Older YAML loaders could instantiate arbitrary objects (`!!python/object`). Always use safe loading functions. JSON parsers have no such feature.
- **Whitespace is not significant.** A stray tab in YAML is a syntax error or, worse, changes the structure silently. JSON survives any reformatting.
- **Size and speed.** JSON is faster to parse and slightly more compact once minified.

## A simple rule

- If a **program** produces or consumes it: JSON.
- If a **person** writes and maintains it, and it needs comments: YAML.
- If both — for example a config file that a build tool also emits — prefer JSON with a documented schema, or use JSONC/JSON5 where your tooling allows comments.

## Converting between them

Because the data model is shared, conversion is lossless in the JSON → YAML direction. YAML → JSON loses comments, anchors and the distinction between block and flow style, but the data survives. The [JSON ↔ YAML converter](/tools/json-to-yaml/) does both directions live and points at the exact line when YAML indentation is wrong. If your JSON will not convert, run it through the [JSON Formatter](/tools/json-formatter/) first to find the syntax error.

## Common YAML pitfalls when converting from JSON

1. **Strings that look like other types** — `yes`, `no`, `on`, `off`, `null`, `~`, numbers with leading zeros. Quote them.
2. **Keys containing colons or hashes** — must be quoted.
3. **Tabs** — YAML forbids tabs for indentation. Use spaces (two is conventional).
4. **Very long lines** — use block scalars instead of escaped newlines.

Pick the format that fails loudest for your situation: JSON for code, YAML for humans, and a converter for the border between them.
