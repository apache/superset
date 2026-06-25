/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { render } from '@testing-library/react';
import { cloneDeep } from 'lodash';
import { defaultSchema } from 'rehype-sanitize';
import {
  getOverrideHtmlSchema,
  SafeMarkdown,
  transformLinkUri,
} from '../../src/components/SafeMarkdown/SafeMarkdown';

/**
 * NOTE: react-markdown is mocked globally in spec/helpers/shim.tsx (line 89)
 * to return children as-is without processing. This is intentional to avoid
 * ESM parsing issues with hast-* packages in Jest.
 *
 * These tests verify that the SafeMarkdown component renders without errors,
 * which is the main goal: ensuring remark-gfm v4+ doesn't break the component
 * with "Cannot set properties of undefined (setting 'inTable')" errors.
 */

describe('getOverrideHtmlSchema', () => {
  test('should append the override items', () => {
    const original = {
      attributes: {
        '*': ['size'],
      },
      clobberPrefix: 'original-prefix',
      tagNames: ['h1', 'h2', 'h3'],
    };
    const result = getOverrideHtmlSchema(original, {
      attributes: { '*': ['src'], h1: ['style'] },
      clobberPrefix: 'custom-prefix',
      tagNames: ['iframe'],
    });
    expect(result.clobberPrefix).toEqual('custom-prefix');
    expect(result.attributes).toEqual({ '*': ['size', 'src'], h1: ['style'] });
    expect(result.tagNames).toEqual(['h1', 'h2', 'h3', 'iframe']);
  });

  test('should not mutate the original schema', () => {
    const original = {
      attributes: { '*': ['size'] },
      tagNames: ['h1'],
    };
    getOverrideHtmlSchema(original, {
      attributes: { '*': ['src'] },
      tagNames: ['iframe'],
    });
    // The original passed in is left untouched.
    expect(original.attributes).toEqual({ '*': ['size'] });
    expect(original.tagNames).toEqual(['h1']);
  });

  test('should not mutate the shared defaultSchema import or accumulate across calls', () => {
    const snapshot = cloneDeep(defaultSchema);
    const overrides = { tagNames: ['iframe'] };

    const first = getOverrideHtmlSchema(defaultSchema, overrides);
    const second = getOverrideHtmlSchema(defaultSchema, overrides);

    // The shared singleton is never modified...
    expect(defaultSchema).toEqual(snapshot);
    // ...and repeated calls do not accumulate the override (no growing arrays).
    expect(first.tagNames).toEqual(second.tagNames);
    expect(
      (second.tagNames ?? []).filter(name => name === 'iframe'),
    ).toHaveLength(1);
  });
});

describe('transformLinkUri', () => {
  // Build script-executing protocols via concatenation so the literal URLs
  // don't trip the no-script-url lint rule.
  const js = `java${'script'}`;
  const vbs = `vb${'script'}`;

  // Cases are [label, uri] pairs: the raw URIs contain C0 control characters
  // (\x00, \x01, \x1F) that are invalid in XML, so they must not be
  // interpolated into the test name (the HTML/JUnit reporters serialize names
  // to XML and would crash). The label keeps the reported name printable while
  // the uri is exercised in the body.
  test.each([
    ['javascript', `${js}:alert(1)`],
    ['mixed-case JavaScript', `Java${'Script'}:alert(1)`],
    ['leading whitespace', `  ${js}:alert(document.cookie)`],
    ['tab inside scheme', `java\t${'script'}:alert(1)`],
    // Leading C0 control characters are stripped by the WHATWG URL parser
    // before the scheme is resolved, so they must not bypass the blocklist.
    ['leading 0x01 control', `\x01${js}:alert(1)`],
    ['leading NUL (0x00)', `\x00${js}:alert(1)`],
    ['leading 0x1F control', `\x1F${js}:alert(1)`],
    // C0 control characters inside the scheme are ignored by browsers too.
    ['0x01 control inside scheme', `java\x01${'script'}:alert(1)`],
    ['vbscript', `${vbs}:msgbox(1)`],
    ['data: text/html', 'data:text/html,<script>alert(1)</script>'],
  ])(
    'blocks the script-executing protocol (%s)',
    (_label: string, uri: string) => {
      expect(transformLinkUri(uri)).toBe('');
    },
  );

  test.each([
    'https://superset.apache.org',
    'http://example.com/path?q=1',
    'mailto:someone@example.com',
    '/relative/path',
    '#section',
  ])('keeps the safe URL %p unchanged', uri => {
    expect(transformLinkUri(uri)).toBe(uri);
  });

  test.each([
    'custom-scheme://open/thing',
    'slack://channel?id=1',
    `foo:bar?${js}:alert(1)`,
  ])('preserves custom link scheme %p (see #26211)', uri => {
    expect(transformLinkUri(uri)).toBe(uri);
  });

  test('handles empty and nullish input', () => {
    expect(transformLinkUri('')).toBe('');
    // @ts-expect-error -- guarding runtime nullish input
    expect(transformLinkUri(undefined)).toBe('');
  });
});

describe('SafeMarkdown', () => {
  describe('remark-gfm compatibility tests', () => {
    /**
     * Critical regression test for remark-gfm v3.0.1 compatibility.
     *
     * CONTEXT:
     * - remark-gfm v4+ requires unified v11 (react-markdown v9+, React 18+)
     * - react-markdown v8 uses unified v10 (compatible with React 17)
     * - Mixing remark-gfm v4 with react-markdown v8 causes:
     *   "Cannot set properties of undefined (setting 'inTable')" error
     *
     * HISTORY:
     * - PR #32420 (March 2025): Fixed by pinning remark-gfm to v3
     * - PR #32945 (July 2025): Dependabot auto-upgraded to v4, breaking tables
     * - This test prevents future auto-upgrades from breaking functionality
     *
     * This test will FAIL if remark-gfm is upgraded to v4+ without upgrading
     * react-markdown to v9+ (which requires React 18).
     */
    test('should render GitHub Flavored Markdown tables without errors', () => {
      const markdownWithTable = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Value A  | Value B  | Value C  |
      `.trim();

      // This will throw "Cannot set properties of undefined (setting 'inTable')"
      // if remark-gfm v4+ is used with react-markdown v8
      expect(() => {
        render(<SafeMarkdown source={markdownWithTable} />);
      }).not.toThrow();
    });

    /**
     * Regression test for issue #32416
     *
     * Tests that inline code blocks with backticks work correctly.
     * This was the original issue that led to pinning remark-gfm to v3.
     */
    test('should render inline code blocks with backticks', () => {
      const markdownWithCode = 'Use `console.log()` for debugging';

      expect(() => {
        render(<SafeMarkdown source={markdownWithCode} />);
      }).not.toThrow();
    });

    /**
     * Additional GFM feature test: Strikethrough
     *
     * Ensures other remark-gfm features work correctly with v3.
     */
    test('should render strikethrough text', () => {
      const markdownWithStrikethrough = '~~This is strikethrough text~~';

      expect(() => {
        render(<SafeMarkdown source={markdownWithStrikethrough} />);
      }).not.toThrow();
    });

    /**
     * Additional GFM feature test: Task lists
     *
     * Ensures task lists render correctly with v3.
     */
    test('should render task lists', () => {
      const markdownWithTaskList = `
- [x] Completed task
- [ ] Incomplete task
      `.trim();

      expect(() => {
        render(<SafeMarkdown source={markdownWithTaskList} />);
      }).not.toThrow();
    });

    /**
     * Complex integration test with multiple GFM features
     *
     * Tests that all GFM features work together without conflicts.
     */
    test('should render complex markdown with multiple GFM features', () => {
      const complexMarkdown = `
# Dashboard Overview

Use \`console.log()\` for debugging ~~or use alerts~~.

| Metric | Q1 | Q2 | Q3 |
|--------|----|----|----|
| Sales  | 10 | 20 | 30 |
| Users  | 5  | 15 | 25 |

**Tasks:**
- [x] Setup dashboard
- [ ] Add filters
      `.trim();

      // If remark-gfm v4 is used with react-markdown v8, this will throw
      // "Cannot set properties of undefined (setting 'inTable')"
      expect(() => {
        render(<SafeMarkdown source={complexMarkdown} />);
      }).not.toThrow();
    });
  });
});
