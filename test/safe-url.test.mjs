import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../dist/framework/safe-url.js';

test('keeps relative and safe absolute URLs', () => {
  for (const url of ['/todos', 'todos/1', '?q=1', '#top', '', '//cdn.example.com/x', 'https://example.com', 'HTTP://x', 'mailto:a@b.c', 'tel:+15555555555']) {
    assert.equal(safeUrl(url), url, url);
  }
});

test('blocks script-capable and unknown schemes', () => {
  for (const url of ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd']) {
    assert.equal(safeUrl(url), 'about:blank#blocked', JSON.stringify(url));
  }
});

test('null and undefined become empty', () => {
  assert.equal(safeUrl(null), '');
  assert.equal(safeUrl(undefined), '');
});
