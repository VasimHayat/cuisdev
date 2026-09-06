import { expect, test } from '@playwright/test';

import { expectEditorValue, expectError, fillEditor } from '../helpers';

const INPUT = 'json-to-xml-input';
const OUTPUT = 'json-to-xml-output';
const DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';

test.describe('json-to-xml tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/json-to-xml/');
  });

  test('converts JSON to XML live and swaps back to JSON', async ({ page }) => {
    await fillEditor(page, INPUT, '{"book":{"@_id":"bk1","title":"Dune","tags":["a","b"]}}');
    await expectEditorValue(
      page,
      OUTPUT,
      DECL +
        '<root>\n  <book id="bk1">\n    <title>Dune</title>\n    <tags>a</tags>\n    <tags>b</tags>\n  </book>\n</root>\n',
    );
    await expect(page.locator('[data-output-stats]')).toContainText('8 lines');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('radio', { name: 'XML → JSON' })).toBeChecked();
    await expectEditorValue(page, INPUT, /<book id="bk1">/);
    await expectEditorValue(
      page,
      OUTPUT,
      '{\n  "root": {\n    "book": {\n      "title": "Dune",\n      "tags": [\n        "a",\n        "b"\n      ],\n      "@_id": "bk1"\n    }\n  }\n}\n',
    );
  });

  test('root element, indent, declaration and attribute prefix options', async ({ page }) => {
    await fillEditor(page, INPUT, '{"a":{"@_id":1,"#text":"hi"}}');
    await expectEditorValue(page, OUTPUT, DECL + '<root>\n  <a id="1">hi</a>\n</root>\n');

    await page.getByLabel('Root element').fill('config');
    await expectEditorValue(page, OUTPUT, DECL + '<config>\n  <a id="1">hi</a>\n</config>\n');

    await page.getByLabel('Indent').selectOption('4');
    await expectEditorValue(page, OUTPUT, DECL + '<config>\n    <a id="1">hi</a>\n</config>\n');

    await page.getByRole('checkbox', { name: 'XML declaration' }).uncheck();
    await expectEditorValue(page, OUTPUT, '<config>\n    <a id="1">hi</a>\n</config>\n');

    // With a different prefix, "@_id" is no longer an attribute and is not a valid element name.
    await page.getByLabel('Attribute prefix').fill('$');
    await expectError(page, /Key "@_id" at \$\.a cannot be used as an XML element name/);
    await fillEditor(page, INPUT, '{"a":{"$id":1,"#text":"hi"}}');
    await expectEditorValue(page, OUTPUT, '<config>\n    <a id="1">hi</a>\n</config>\n');
  });

  test('a blank root name uses the single top-level key', async ({ page }) => {
    await fillEditor(page, INPUT, '{"note":{"to":"Ada"}}');
    await page.getByLabel('Root element').fill('');
    await expectEditorValue(page, OUTPUT, DECL + '<note>\n  <to>Ada</to>\n</note>\n');

    await fillEditor(page, INPUT, '{"a":1,"b":2}');
    await expectError(page, /exactly one top-level key/);
  });

  test('converts XML to JSON with attribute, typing and minify options', async ({ page }) => {
    await page.getByText('XML → JSON', { exact: true }).click();
    await fillEditor(page, INPUT, '<r><n id="7">42</n><ok>true</ok></r>');
    await expectEditorValue(
      page,
      OUTPUT,
      '{\n  "r": {\n    "n": {\n      "#text": 42,\n      "@_id": 7\n    },\n    "ok": true\n  }\n}\n',
    );

    await page.getByRole('checkbox', { name: 'Parse numbers and booleans' }).uncheck();
    await expectEditorValue(page, OUTPUT, /"#text": "42"/);

    await page.getByRole('checkbox', { name: 'Ignore attributes' }).check();
    await page.getByRole('checkbox', { name: 'Minified JSON' }).check();
    await expectEditorValue(page, OUTPUT, '{"r":{"n":"42","ok":"true"}}\n');
  });

  test('rejects invalid root names and keys with a clear message', async ({ page }) => {
    await fillEditor(page, INPUT, '{"first name":1}');
    await expectError(page, /Key "first name" at \$ cannot be used as an XML element name/);

    await fillEditor(page, INPUT, '{"a":1}');
    await page.getByLabel('Root element').fill('1abc');
    await expectError(page, /"1abc" is not a valid XML element name/);
  });

  test('underlines invalid JSON with its position', async ({ page }) => {
    await fillEditor(page, INPUT, '{"a":1,}');
    await expectError(page, /Invalid JSON at line 1, column 8/);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
    await expectEditorValue(page, OUTPUT, '');
  });

  test('underlines invalid XML with line and column', async ({ page }) => {
    await page.getByText('XML → JSON', { exact: true }).click();
    await fillEditor(page, INPUT, '<root>\n<a>\n</root>');
    await expectError(page, /Invalid XML at line 3, column 1: Expected closing tag 'a'/);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
    await expectEditorValue(page, OUTPUT, '');
  });

  test('sample, copy and clear', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT, /<root version="2\.1">\n {2}<book id="bk101">/);

    const copy = page.getByRole('button', { name: /^Cop(y|ied!)$/ });
    await copy.click();
    await expect(copy).toHaveText(/Copied!/);

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expectEditorValue(page, INPUT, '');
    await expectEditorValue(page, OUTPUT, '');
    await expect(page.getByRole('status')).toHaveText('');
  });

  test('downloads with the right extension for each direction', async ({ page }) => {
    await fillEditor(page, INPUT, '{"a":1}');
    await expectEditorValue(page, OUTPUT, /<a>1<\/a>/);
    let download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('converted.xml');

    await page.getByRole('button', { name: /swap/i }).click();
    await expectEditorValue(page, OUTPUT, /"a": 1/);
    download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('converted.json');
  });
});
