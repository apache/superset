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
import { render, waitFor } from '@testing-library/react';
import {
  getOverrideHtmlSchema,
  SafeMarkdown,
} from '../../src/components/SafeMarkdown/SafeMarkdown';

describe('getOverrideHtmlSchema', () => {
  it('should append the override items', () => {
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
    it('should render GitHub Flavored Markdown tables without errors', async () => {
      const markdownWithTable = `
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Value A  | Value B  | Value C  |
      `.trim();

      // This will throw "Cannot set properties of undefined (setting 'inTable')"
      // if remark-gfm v4+ is used with react-markdown v8
      const { container } = render(<SafeMarkdown source={markdownWithTable} />);

      // Wait for async markdown rendering
      await waitFor(() => {
        const table = container.querySelector('table');
        expect(table).toBeInTheDocument();
      });

      // Verify table structure
      const tableHeaders = container.querySelectorAll('th');
      expect(tableHeaders).toHaveLength(3);
      expect(tableHeaders[0]).toHaveTextContent('Header 1');
      expect(tableHeaders[1]).toHaveTextContent('Header 2');
      expect(tableHeaders[2]).toHaveTextContent('Header 3');

      const tableRows = container.querySelectorAll('tbody tr');
      expect(tableRows).toHaveLength(2);

      const firstRowCells = tableRows[0].querySelectorAll('td');
      expect(firstRowCells[0]).toHaveTextContent('Cell 1');
      expect(firstRowCells[1]).toHaveTextContent('Cell 2');
      expect(firstRowCells[2]).toHaveTextContent('Cell 3');
    });

    /**
     * Regression test for issue #32416
     *
     * Tests that inline code blocks with backticks work correctly.
     * This was the original issue that led to pinning remark-gfm to v3.
     */
    it('should render inline code blocks with backticks', async () => {
      const markdownWithCode = 'Use `console.log()` for debugging';

      const { container } = render(<SafeMarkdown source={markdownWithCode} />);

      await waitFor(() => {
        const code = container.querySelector('code');
        expect(code).toBeInTheDocument();
        expect(code).toHaveTextContent('console.log()');
      });
    });

    /**
     * Additional GFM feature test: Strikethrough
     *
     * Ensures other remark-gfm features work correctly with v3.
     */
    it('should render strikethrough text', async () => {
      const markdownWithStrikethrough = '~~This is strikethrough text~~';

      const { container } = render(
        <SafeMarkdown source={markdownWithStrikethrough} />,
      );

      await waitFor(() => {
        const del = container.querySelector('del');
        expect(del).toBeInTheDocument();
        expect(del).toHaveTextContent('This is strikethrough text');
      });
    });

    /**
     * Additional GFM feature test: Task lists
     *
     * Ensures task lists render correctly with v3.
     */
    it('should render task lists', async () => {
      const markdownWithTaskList = `
- [x] Completed task
- [ ] Incomplete task
      `.trim();

      const { container } = render(
        <SafeMarkdown source={markdownWithTaskList} />,
      );

      await waitFor(() => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes).toHaveLength(2);
        expect(checkboxes[0]).toBeChecked();
        expect(checkboxes[1]).not.toBeChecked();
      });
    });

    /**
     * Complex integration test with multiple GFM features
     *
     * Tests that all GFM features work together without conflicts.
     */
    it('should render complex markdown with multiple GFM features', async () => {
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

      const { container } = render(<SafeMarkdown source={complexMarkdown} />);

      await waitFor(() => {
        // Check heading
        expect(container.querySelector('h1')).toHaveTextContent(
          'Dashboard Overview',
        );

        // Check code
        expect(container.querySelector('code')).toHaveTextContent(
          'console.log()',
        );

        // Check strikethrough
        expect(container.querySelector('del')).toBeInTheDocument();

        // Check table
        const table = container.querySelector('table');
        expect(table).toBeInTheDocument();
        expect(table?.querySelectorAll('th')).toHaveLength(4);
        expect(table?.querySelectorAll('tbody tr')).toHaveLength(2);

        // Check task list
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes).toHaveLength(2);
      });
    });
  });
});
