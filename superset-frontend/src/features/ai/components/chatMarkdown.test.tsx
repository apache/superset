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

/**
 * `react-markdown` is mocked to a pass-through in the shared jest shim (it is
 * ESM-only and is not in the transform allowlist), so these exercise the
 * component overrides directly against hast nodes of the shape the parser
 * produces. That is the interesting part anyway: which node gets block treatment
 * and which does not.
 */

import type { ReactElement } from 'react';
import type { Element } from 'hast';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { renderSqlHighlightedCode, useChatMarkdown } from './chatMarkdown';

// The embedded chart resolves a form_data key over the network and renders a real
// chart; only the fact that the fence reached it is under test here.
jest.mock('./ChatChartEmbed', () => ({
  __esModule: true,
  default: ({
    formDataKey,
    title,
  }: {
    formDataKey: string;
    title?: string;
  }) => (
    <div data-test="chart-embed" data-key={formDataKey}>
      {title}
    </div>
  ),
  parseChartEmbedParams:
    jest.requireActual('./ChatChartEmbed').parseChartEmbedParams,
}));

/** A `pre > code` node, which is what a fenced block parses to. */
const fenceNode = (
  code: string,
  language?: string,
  meta?: string,
): Element => ({
  type: 'element',
  tagName: 'pre',
  properties: {},
  children: [
    {
      type: 'element',
      tagName: 'code',
      properties: language ? { className: [`language-${language}`] } : {},
      children: [{ type: 'text', value: code }],
      ...(meta ? { data: { meta } } : {}),
    },
  ],
});

/**
 * Renders one markdown override.
 *
 * `components` is typed against JSX intrinsics, so the override is read out and
 * invoked with the props react-markdown would pass it.
 */
const Subject = ({
  render: renderOverride,
}: {
  render: (components: ReturnType<typeof useChatMarkdown>) => ReactElement;
}) => renderOverride(useChatMarkdown());

const renderPre = (node: Element, sqlLabDefaultDbId?: number) =>
  render(
    <Subject
      render={({ createMarkdownComponents }) => {
        const components = createMarkdownComponents('message-1');
        const Pre = components.pre as (props: {
          node: Element;
          children: ReactElement | string;
        }) => ReactElement;
        return (
          <Pre node={node}>
            <code>fallback</code>
          </Pre>
        );
      }}
    />,
    {
      useRedux: true,
      useRouter: true,
      initialState: {
        common: { conf: { SQLLAB_DEFAULT_DBID: sqlLabDefaultDbId } },
        sqlLab: { queryEditors: [], tabHistory: [], unsavedQueryEditor: {} },
      },
    },
  );

test('the code override is left alone, so inline code keeps the default rendering', () => {
  render(
    <Subject
      render={({ createMarkdownComponents }) => {
        const components = createMarkdownComponents('message-1');
        // react-markdown 10 dropped the `inline` prop, so block handling hangs
        // off `pre` and `code` is deliberately not overridden — which is what
        // leaves inline spans untouched.
        expect(components.code).toBeUndefined();
        return <span>checked</span>;
      }}
    />,
    { useRedux: true, useRouter: true },
  );

  expect(screen.getByText('checked')).toBeInTheDocument();
});

test('a fenced block gets the copy action', () => {
  renderPre(fenceNode('plain text\n'));

  expect(screen.getByLabelText('Copy code block')).toBeInTheDocument();
  expect(screen.getByText('plain text')).toBeInTheDocument();
});

test('a language-less fence is still treated as a block', () => {
  // The className that would identify a language is absent here, which is why
  // the block/inline decision cannot be made from it.
  renderPre(fenceNode('no language'));

  expect(screen.getByLabelText('Copy code block')).toBeInTheDocument();
});

test('a single-line SQL fence offers Run in SQL Lab', () => {
  renderPre(fenceNode('SELECT 1', 'sql'), 3);

  // Source positions cannot tell a one-line fence from inline code, which the
  // `pre` override sidesteps.
  expect(screen.getByLabelText('Run in SQL Lab')).toBeInTheDocument();
});

test('Run in SQL Lab is hidden when no database can be resolved', () => {
  renderPre(fenceNode('SELECT 1', 'sql'));

  // Opening an editor pointed at an arbitrary database would be worse than not
  // offering the action.
  expect(screen.queryByLabelText('Run in SQL Lab')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Copy code block')).toBeInTheDocument();
});

test("the fence's info string names the database, so Run is offered without a default", () => {
  renderPre(fenceNode('SELECT 1', 'sql', '7'));

  expect(screen.getByLabelText('Run in SQL Lab')).toBeInTheDocument();
});

test('a long SQL block collapses and can be expanded', async () => {
  const sql = Array.from({ length: 12 }, (_, index) => `SELECT ${index}`).join(
    '\n',
  );
  renderPre(fenceNode(sql, 'sql'), 3);

  await userEvent.click(screen.getByLabelText('Expand SQL code block'));

  expect(screen.getByLabelText('Collapse SQL code block')).toBeInTheDocument();
});

test('a short SQL block is not collapsible', () => {
  renderPre(fenceNode('SELECT 1', 'sql'), 3);

  expect(
    screen.queryByLabelText('Expand SQL code block'),
  ).not.toBeInTheDocument();
});

test('a superset-chart fence renders the embed instead of the source', () => {
  renderPre(
    fenceNode(
      'form_data_key=abc-123\ntitle=Revenue\nheight=250',
      'superset-chart',
    ),
  );

  const embed = screen.getByTestId('chart-embed');
  expect(embed).toHaveAttribute('data-key', 'abc-123');
  expect(embed).toHaveTextContent('Revenue');
});

test('a superset-chart fence with no usable key keeps its source visible', () => {
  renderPre(fenceNode('form_data_key=not a key', 'superset-chart'));

  expect(screen.queryByTestId('chart-embed')).not.toBeInTheDocument();
  expect(screen.getByText('fallback')).toBeInTheDocument();
});

test('a pre with no code child is passed through unchanged', () => {
  renderPre({
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [{ type: 'text', value: 'not a fence' }],
  });

  expect(screen.getByText('fallback')).toBeInTheDocument();
  expect(screen.queryByLabelText('Copy code block')).not.toBeInTheDocument();
});

test('SQL highlighting colours keywords, strings and comments separately', () => {
  render(<div>{renderSqlHighlightedCode("-- note\nSELECT 'x' FROM t")}</div>);

  expect(screen.getByText('-- note')).toBeInTheDocument();
  expect(screen.getByText('SELECT')).toBeInTheDocument();
  expect(screen.getByText("'x'")).toBeInTheDocument();
  expect(screen.getByText('FROM')).toBeInTheDocument();
});
