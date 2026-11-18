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
import { render, screen } from 'spec/helpers/testing-library';
import CanvasGrid, { emptyScopeValues } from './CanvasGrid';
import { registerBuiltinRenderers } from './builtinRenderers';
import { CanvasDefinitionResult } from './types';
import type { CanvasLayout } from './useCanvasLayout';

const inline = (
  widgetType: string,
  props: Record<string, unknown> = {},
  children?: string[],
) => ({ widgetType, schemaVersion: 1, props, layout: {}, children });

const result: CanvasDefinitionResult = {
  version: 1,
  revision: 1,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['overview', 'kpis'],
    },
    nodes: {
      overview: inline('tabs', {}, ['emea', 'apac']),
      emea: inline('tab', { title: 'EMEA' }, ['notes']),
      apac: inline('tab', {}, []),
      notes: inline('markdown', { content: '**Quarterly** notes' }),
      kpis: inline('group', { title: 'Key numbers' }, []),
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings: {
      refresh: { interval: 0, stagger: 0, exempt: [] },
      colors: { labelColors: {} },
      display: { showTimestamps: false },
      crossFilters: { enabled: true },
    },
  },
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  eventScopes: {},
  placements: {},
  layouts: {},
  childOrder: { root: ['overview', 'kpis'] },
  widgetTypes: {
    overview: 'tabs',
    emea: 'tab',
    apac: 'tab',
    notes: 'markdown',
    kpis: 'group',
  },
  gridColumns: { emea: 24, apac: 24, kpis: 12 },
  layoutConstraints: {},
  canEdit: false,
};

test('renders core containers and markdown without extensions', async () => {
  registerBuiltinRenderers();
  render(
    <CanvasGrid
      canvasId={1}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={{
        placements: result.placements,
        layouts: result.layouts,
        childOrder: result.childOrder,
        layoutConstraints: result.layoutConstraints,
        revision: result.revision,
        saving: false,
        place: jest.fn(),
        move: jest.fn(),
        swap: jest.fn(),
        filterScopes: {},
        crossFilterScopes: {},
        customizationScopes: {},
        eventScopes: {},
        remove: jest.fn(),
        removed: new Set<string>(),
        dismissError: jest.fn(),
      }}
      editable={false}
    />,
  );

  expect(screen.getByRole('tab', { name: 'EMEA' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Untitled tab' })).toBeInTheDocument();
  // react-markdown is stubbed in tests (spec/helpers/shim.tsx) to echo its source.
  expect(await screen.findByText(/Quarterly/)).toBeInTheDocument();
  expect(screen.getByText('Key numbers')).toBeInTheDocument();

  // A group's title fills exactly the row the server keeps above its grid,
  // and nothing more: the container clips, so chrome taller than its
  // reservation cuts the bottom off the grid's last row. Taking the figure
  // from the grid rather than carrying its own is what stops the two
  // drifting -- a fixed margin plus a heading's line box came to more than
  // the row kept for it, and every titled group clipped by the difference.
  const style = getComputedStyle(
    screen.getByRole('heading', { name: 'Key numbers' }),
  );

  expect(style.height).toContain('var(--canvas-chrome-rows');
  expect(style.marginTop).toBe('0px');
});

const layoutOf = (canvasResult: CanvasDefinitionResult): CanvasLayout => ({
  placements: canvasResult.placements,
  layouts: canvasResult.layouts,
  childOrder: canvasResult.childOrder,
  layoutConstraints: canvasResult.layoutConstraints,
  revision: canvasResult.revision,
  saving: false,
  place: jest.fn(),
  move: jest.fn(),
  swap: jest.fn(),
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  eventScopes: {},
  remove: jest.fn(),
  removed: new Set<string>(),
  dismissError: jest.fn(),
});

/**
 * A titled group whose last row is filled, with a widget right after it, on a
 * grid of 24px rows and 8px gaps rather than the default 40 and 16. Placed
 * explicitly, with layouts that match, so fitting them changes nothing.
 */
const titledGroup = (title: string): CanvasDefinitionResult => {
  const placements = {
    kpis: { col: 1, row: 1, colSpan: 24, rowSpan: 3 },
    revenue: { col: 1, row: 1, colSpan: 12, rowSpan: 1 },
    margin: { col: 1, row: 2, colSpan: 12, rowSpan: 1 },
    after: { col: 1, row: 4, colSpan: 24, rowSpan: 1 },
  };
  return {
    ...result,
    definition: {
      ...result.definition,
      root: {
        layout: { columns: 24, gap: 8, rowUnit: 24 },
        children: ['kpis', 'after'],
      },
      nodes: {
        kpis: inline('group', { title }, ['revenue', 'margin']),
        revenue: inline('markdown', { content: 'Revenue' }),
        margin: inline('markdown', { content: 'Margin' }),
        after: inline('markdown', { content: 'After' }),
      },
    },
    placements,
    layouts: placements,
    childOrder: { root: ['kpis', 'after'], kpis: ['revenue', 'margin'] },
    widgetTypes: {
      kpis: 'group',
      revenue: 'markdown',
      margin: 'markdown',
      after: 'markdown',
    },
    gridColumns: { kpis: 24 },
    chromeRows: { kpis: 1 },
  };
};

const renderCanvas = (canvasResult: CanvasDefinitionResult) => {
  registerBuiltinRenderers();
  return render(
    <CanvasGrid
      canvasId={1}
      result={canvasResult}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layoutOf(canvasResult)}
      editable
    />,
  );
};

test('a titled group holds its last row under its title, at any grid metrics', () => {
  // The title takes the one row the server keeps for the group's chrome --
  // one row of this grid, 24 + 8 -- and the group's grid gets the rest. The
  // group clips, so a title taller than that row would cut its last row off.
  const { container } = renderCanvas(titledGroup('Key numbers'));
  const node = (nodeId: string) =>
    container.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
  const rowOf = (nodeId: string) => getComputedStyle(node(nodeId)).gridRow;
  const heading = screen.getByRole('heading', { name: 'Key numbers' });
  const [rootGrid, groupGrid] = Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-test="canvas-grid-surface"]',
    ),
  );

  // Two rows of content plus the title's row, and nothing grown to fit.
  expect(rowOf('kpis')).toBe('1/span 3');
  expect(rowOf('margin')).toBe('2/span 1');
  // The widget after the group starts where the group ends.
  expect(rowOf('after')).toBe('4/span 1');
  expect(node('kpis')).not.toContainElement(node('after'));

  // The title's height is the grid's row, read from the grid.
  expect(getComputedStyle(heading).height).toContain(
    'var(--canvas-chrome-rows',
  );
  expect(
    getComputedStyle(rootGrid).getPropertyValue('--canvas-chrome-rows'),
  ).toBe('32px');
  expect(getComputedStyle(heading).marginTop).toBe('0px');
  // The group's grid takes what the title leaves, and the group clips it.
  expect(heading.nextElementSibling).toBe(groupGrid);
  expect(getComputedStyle(groupGrid).flex).toBe('1 1 auto');
  expect(
    getComputedStyle(
      node('kpis').querySelector('.canvas-content') as HTMLElement,
    ).overflow,
  ).toBe('clip');
});

test('a long group title is cut short inside its strip rather than overflowing it', () => {
  const title = 'Quarterly revenue by region and product line '.repeat(6);
  renderCanvas(titledGroup(title));
  const heading = screen.getByRole('heading', { name: title.trim() });
  const text = heading.firstElementChild as HTMLElement;

  // The heading lays out its contents as a row, which text-overflow does not
  // apply to, so the text inside it is what gets cut.
  expect(text).toBeInstanceOf(HTMLSpanElement);
  expect(text).toHaveTextContent(title.trim());
  const textStyle = getComputedStyle(text);
  expect(text).toHaveAttribute('title', title);
  expect(textStyle.overflow).toBe('hidden');
  expect(textStyle.textOverflow).toBe('ellipsis');
  expect(textStyle.whiteSpace).toBe('nowrap');
  expect(textStyle.minWidth).toBe('0');

  const headingStyle = getComputedStyle(heading);
  // Never squeezed by the grid below it, and clear of the remove button --
  // 8 units wide, 4 in from the right edge -- and the mark beside it.
  expect(headingStyle.flexShrink).toBe('0');
  expect(headingStyle.minWidth).toBe('0');
  expect(headingStyle.paddingRight).toBe('var(--canvas-controls-inset, 0px)');
  // Above the frame a first-row child draws 2 units outside its box, line
  // included, so neither the name nor the mark sits on it.
  expect(headingStyle.paddingBottom).toBe('9px');
  expect(headingStyle.height).toContain('var(--canvas-chrome-rows');
});
