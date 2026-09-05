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
import { render, screen } from '@superset-ui/core/spec';
import Handlebars from '../src/Handlebars';
import { HandlebarsProps } from '../src/types';

// `spec/helpers/shim.tsx` swaps react-markdown and the rehype plugins for stubs
// that echo their input, so suites that don't care about Markdown skip parsing
// it. What these tests assert is how Markdown parses the chart source, so they
// need the real pipeline: against the stub nothing is ever parsed and the
// regression below cannot show up.
jest.mock('react-markdown', () => jest.requireActual('react-markdown'));
jest.mock('rehype-raw', () => jest.requireActual('rehype-raw'));
jest.mock('rehype-sanitize', () => jest.requireActual('rehype-sanitize'));

// The blank line between the two rules is what Markdown reacts to, and the
// universal selector on the line after it is what makes the damage legible:
// parsed as Markdown, `* ` opens a list item and the selector is swallowed.
const STYLE_TEMPLATE =
  'td {\n  color: red;\n}\n\n* {\n  font-family: monospace;\n}';
const TABLE_TEMPLATE =
  '<table>\n  <tr><th>Header</th></tr>\n  <tr><td>Cell</td></tr>\n</table>';

// `style` is not in the sanitizer's default allowlist, so the chart's CSS
// reaches the DOM only where an operator allows the tag through
// HTML_SANITIZATION_SCHEMA_EXTENSIONS. HandlebarsViewer reads that config from
// the bootstrap data on `#app`, which these tests have to provide to observe
// the style block at all.
const appRoot = () => document.getElementById('app');

beforeEach(() => {
  appRoot()?.setAttribute(
    'data-bootstrap',
    JSON.stringify({
      common: {
        conf: {
          HTML_SANITIZATION_SCHEMA_EXTENSIONS: { tagNames: ['style'] },
        },
      },
    }),
  );
});

afterEach(() => {
  appRoot()?.setAttribute('data-bootstrap', '');
});

const renderChart = (
  formData: Partial<HandlebarsProps['formData']>,
  data: Record<string, unknown>[] = [],
) =>
  render(
    <Handlebars
      {...({
        data,
        height: 100,
        width: 100,
        formData,
      } as unknown as HandlebarsProps)}
    />,
  );

/** What a user sees in the chart, i.e. everything but the style block. */
const chartText = (container: HTMLElement) => {
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style').forEach(node => node.remove());
  return clone.textContent?.trim();
};

test('renders the CSS as a style block rather than as chart content', async () => {
  const { container } = renderChart({
    handlebarsTemplate: TABLE_TEMPLATE,
    styleTemplate: STYLE_TEMPLATE,
  });
  expect(await screen.findByText('Cell')).toBeInTheDocument();

  // Markdown only treats `<style>` as a raw-text block that may contain blank
  // lines when the tag starts a block of its own. Appended to a template that
  // opens with an HTML tag it was absorbed into that block instead, so the
  // first blank line in the CSS closed the block and everything after it was
  // parsed as Markdown: rules reached the style block rewritten or, as with
  // the universal selector here, silently dropped, and could end up displayed
  // in the chart.
  expect(container.querySelector('style')).toHaveProperty(
    'textContent',
    STYLE_TEMPLATE,
  );
  expect(chartText(container)).toBe('HeaderCell');
});

test('keeps the CSS intact when the template ends with whitespace control', async () => {
  const { container } = renderChart({
    handlebarsTemplate: `${TABLE_TEMPLATE}{{!-- comment --~}}`,
    styleTemplate: STYLE_TEMPLATE,
  });
  expect(await screen.findByText('Cell')).toBeInTheDocument();

  // `~}}` strips every whitespace character that follows it in the compiled
  // source. When the CSS was joined to the template before compilation, that
  // erased the separator between them and glued `<style>` back onto the
  // template's HTML block, so a valid template re-opened the bug above. The
  // CSS parses as its own document, out of the template's reach.
  expect(container.querySelector('style')).toHaveProperty(
    'textContent',
    STYLE_TEMPLATE,
  );
  expect(chartText(container)).toBe('HeaderCell');
});

test('leaves the template markup untouched when CSS is configured', async () => {
  const { container } = renderChart({
    handlebarsTemplate: '- one\n- two',
    styleTemplate: STYLE_TEMPLATE,
  });
  expect(await screen.findByText('one')).toBeInTheDocument();

  // The template renders as its own Markdown document with nothing appended,
  // so the list stays tight (no paragraph wrapping its items).
  expect(container.querySelectorAll('li p')).toHaveLength(0);
});

test('renders the style block after the template', async () => {
  const { container } = renderChart({
    handlebarsTemplate: TABLE_TEMPLATE,
    styleTemplate: STYLE_TEMPLATE,
  });
  expect(await screen.findByText('Cell')).toBeInTheDocument();

  // Positional selectors are written against the template, so the template has
  // to keep its place in the DOM: a rule like `table:first-child` still has to
  // match the table the chart author wrote.
  const chart = container.querySelector('table')?.parentElement;
  expect(chart?.firstElementChild?.tagName).toBe('TABLE');
  expect(chart?.lastElementChild?.tagName).toBe('STYLE');
  expect(chart?.querySelector('table:first-child')).not.toBeNull();
});

test('lets the CSS control override a style block in the template', async () => {
  const { container } = renderChart({
    handlebarsTemplate: `<style>td { color: blue; }</style>\n${TABLE_TEMPLATE}`,
    styleTemplate: STYLE_TEMPLATE,
  });
  expect(await screen.findByText('Cell')).toBeInTheDocument();

  // Two competing rules of equal specificity are resolved by document order,
  // so the CSS control has to stay last to keep winning over a `<style>` block
  // written into the template itself.
  const styles = Array.from(container.querySelectorAll('style'));
  expect(styles.map(node => node.textContent)).toEqual([
    'td { color: blue; }',
    STYLE_TEMPLATE,
  ]);
});

test('expands Handlebars expressions in the CSS against the chart data', async () => {
  const { container } = renderChart(
    {
      handlebarsTemplate: '{{#each data}}<p>{{name}}</p>{{/each}}',
      styleTemplate: 'p {\n  color: {{data.[0].color}};\n}',
    },
    [{ name: 'Alpha', color: 'rebeccapurple' }],
  );
  expect(await screen.findByText('Alpha')).toBeInTheDocument();

  // The CSS is compiled on its own, but against the same context as the
  // template, so expressions in it keep resolving to the chart's data.
  expect(container.querySelector('style')).toHaveProperty(
    'textContent',
    'p {\n  color: rebeccapurple;\n}',
  );
});

test('renders no style block when no CSS is configured', async () => {
  const { container } = renderChart({ handlebarsTemplate: TABLE_TEMPLATE });
  expect(await screen.findByText('Cell')).toBeInTheDocument();

  expect(container.querySelector('style')).toBeNull();
});
