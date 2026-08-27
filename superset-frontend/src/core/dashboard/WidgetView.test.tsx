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
import { dashboard as dashboardApi } from '@apache-superset/core';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import DashboardProvider from './DashboardProvider';
import { registerBuiltInWidgets } from './registerBuiltInWidgets';
import WidgetView from './WidgetView';

const mockSetOption = jest.fn();

jest.mock('echarts/core', () => ({
  __esModule: true,
  use: jest.fn(),
  init: jest.fn(() => ({
    setOption: mockSetOption,
    resize: jest.fn(),
    dispose: jest.fn(),
    on: jest.fn(),
  })),
}));

jest.mock('./chartData', () => ({
  __esModule: true,
  fetchQueryData: jest.fn(async () => ({
    rows: [{ region: 'west' }],
    columns: ['region'],
  })),
}));

const provider = DashboardProvider.getInstance();

beforeAll(() => {
  registerBuiltInWidgets();
  // ChartWidget's own `useElementSize` needs this to ever measure a
  // non-zero size — without it, the chart never renders past "loading".
  window.ResizeObserver = class {
    constructor(private callback: ResizeObserverCallback) {}

    observe() {
      this.callback(
        [{ contentRect: { width: 400, height: 300 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }

    unobserve() {}

    disconnect() {}
  };
});

beforeEach(() => {
  provider.reset();
});

const withBlock = () => {
  const rootId = provider.getRoot().id;
  const id = provider.addWidget(rootId, 0, {
    type: 'metric-tile',
    props: { label: 'Quarterly notes' },
  });
  render(<WidgetView nodeId={id} />);
  return { rootId, id };
};

test('a widget says which one it is', () => {
  const { id } = withBlock();

  // Named by the same call the Outline names its rows by, so a widget is not
  // "Quarterly notes" in one place and "Metric Tile" in the other.
  expect(screen.getByTestId(`widget-title-${id}`)).toHaveTextContent(
    'Quarterly notes',
  );
});

test('the delete control does not have to be found first', () => {
  const { id } = withBlock();

  // It used to appear only on hover, which is a control you have to already
  // know is there. `toBeVisible` fails on the opacity that hid it.
  expect(screen.getByTestId(`widget-remove-${id}`)).toBeVisible();
});

test('removing a widget is offered as a bin, not as a cross', () => {
  const { id } = withBlock();

  // A cross on a card is the gesture for dismissing the card — closing it,
  // putting it away, getting it off screen. This takes the widget off the
  // dashboard, and the bin is what says that everywhere else in the app.
  expect(
    screen.getByTestId(`widget-remove-${id}`).querySelector('.anticon-delete'),
  ).toBeInTheDocument();
});

test('the root carries no header of its own', () => {
  const rootId = provider.getRoot().id;
  render(<WidgetView nodeId={rootId} />);

  // The root is the dashboard rather than something on it: a header there
  // would label it "Canvas" and offer a delete the provider refuses.
  expect(
    screen.queryByTestId(`widget-header-${rootId}`),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId(`widget-remove-${rootId}`),
  ).not.toBeInTheDocument();
});

test('the overflow menu sits to the right of the bin', () => {
  const { id } = withBlock();

  const bin = screen.getByTestId(`widget-remove-${id}`);
  const menu = screen.getByTestId(`widget-menu-${id}`);
  expect(
    bin.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('the bin does not double its own spacing with the gap before the menu', () => {
  const { id } = withBlock();

  // ActionButton bakes in its own trailing margin for sitting alone at the
  // end of a row; here it sits mid-row against the header's own gap, and
  // the two together doubled the space before the menu that follows it.
  const bin = screen.getByTestId(`widget-remove-${id}`);
  expect(getComputedStyle(bin).marginRight).toBe('0px');
});

test('the overflow menu does not duplicate the bin', async () => {
  const { id } = withBlock();

  // Disabling every placeholder to make room for a working Remove would
  // bury the one real action here — the bin already offers it.
  await userEvent.click(screen.getByTestId(`widget-menu-${id}`));

  expect(await screen.findByText('Force refresh')).toBeInTheDocument();
  expect(screen.queryByText('Remove widget')).not.toBeInTheDocument();
});

test("a widget's name reads as its title, not as a caption on it", () => {
  const { id } = withBlock();

  // Set in the secondary colour at the small size, it read as an annotation
  // hanging above the widget rather than as the name of the thing below it —
  // which is what it is, and the first thing anyone scanning the canvas uses
  // to tell one widget from the next.
  const title = screen.getByTestId(`widget-title-${id}`);

  expect(title).toHaveStyle({ color: 'rgba(0, 0, 0, 0.88)' });
  // Compared rather than pinned: `fontWeightStrong` is a theme token, and it
  // does not resolve to the same number here as it does in the app. Asserting
  // the literal would be asserting the test theme's value, which is not the
  // one that ships.
  expect(Number(getComputedStyle(title).fontWeight)).toBeGreaterThan(400);
});

/** The element a node draws itself as — the card, for a widget that has one. */
const frameOf = (id: string) =>
  document.querySelector(`[data-node-id="${id}"]`) as HTMLElement;

test('a widget hides what it is drawn over, name and all', () => {
  const { rootId, id } = withBlock();

  // A free canvas lets widgets overlap, and only the leaf's own box was ever
  // opaque — so a widget raised to the front still showed whatever sat behind
  // it through the strip carrying its name, and two overlapping widgets
  // rendered their names on top of each other.
  expect(frameOf(id)).toHaveStyle({ backgroundColor: '#FFFFFF' });
  // The root is the canvas everything is arranged on, not a card on it.
  render(<WidgetView nodeId={rootId} />);
  expect(frameOf(rootId)).not.toHaveStyle({ backgroundColor: '#FFFFFF' });
});

test('a widget is one card, with its name inside the frame rather than above it', () => {
  const { id } = withBlock();

  // The frame was drawn by the leaf, which begins below the header — so a
  // card's top edge ran between a widget's name and its contents, and the name
  // read as a caption floating over a separate box rather than as the head of
  // the card it belongs to. Drawn once, around both, it is one card.
  const frame = frameOf(id);
  expect(frame.style.border).toMatch(/^1px solid /);
  expect(frame.style.borderRadius).not.toBe('');
  // Nothing can spill past the corners the frame rounds.
  expect(frame).toHaveStyle({ overflow: 'hidden' });

  // And the band no longer paints a surface of its own over the one it is on:
  // two backgrounds meeting at the header's edge is the seam this removes.
  expect(screen.getByTestId(`widget-header-${id}`).style.backgroundColor).toBe(
    '',
  );
});

test('a leaf widget no longer frames itself, so there is one border and not two', () => {
  const { id } = withBlock();

  const leaf = screen.getByTestId(`widget-content-${id}`)
    .firstElementChild as HTMLElement;
  expect(leaf.style.border).toBe('');
  expect(leaf.style.borderRadius).toBe('');
  expect(leaf.style.backgroundColor).toBe('');
});

test('the header takes its height out of the widget, not out of the canvas', () => {
  const { rootId, id } = withBlock();

  // A leaf widget resolves `height: 100%` against this box — a chart measures
  // the result to size its canvas — so the band above it has to come out of
  // the height rather than be added to it, or every widget overflows its cell
  // by exactly the header.
  expect(screen.getByTestId(`widget-content-${id}`).style.height).toMatch(
    /^calc\(100% - \d+px\)$/,
  );
  // The root has no header to subtract.
  render(<WidgetView nodeId={rootId} />);
  expect(screen.getByTestId(`widget-content-${rootId}`)).toHaveStyle({
    height: '100%',
  });
});

/** A widget type `widgetLabel` leaves unnamed — see its own UNNAMED set. */
const withUnnamedWidget = () => {
  const rootId = provider.getRoot().id;
  const id = provider.addWidget(rootId, 0, {
    type: 'markdown',
    props: { content: 'Hello' },
  });
  render(<WidgetView nodeId={id} />);
  return { rootId, id };
};

test('a widget with no title gives its content the whole box, not a row minus a header', () => {
  const { id } = withUnnamedWidget();

  // Markdown has nothing to put in a header row (its own rendered body
  // sits right below it) — reserving one anyway was a band of blank space
  // above the actual content, with nothing on either side of it.
  expect(screen.getByTestId(`widget-content-${id}`)).toHaveStyle({
    height: '100%',
  });
});

test('a widget with no title still offers its remove control, floated over its content', () => {
  const { id } = withUnnamedWidget();

  // Dropping the header row must not also drop the only way to delete the
  // widget from the canvas itself.
  expect(screen.getByTestId(`widget-remove-${id}`)).toBeVisible();
  expect(screen.queryByTestId(`widget-title-${id}`)).not.toBeInTheDocument();
});

const CHART_DATASET_ID = 7;

const withChart = () => {
  const rootId = provider.getRoot().id;
  const id = provider.addWidget(rootId, 0, {
    type: 'echarts',
    props: {
      dataBinding: {
        datasetId: CHART_DATASET_ID,
        dimensions: ['region'],
        metrics: [],
      },
      echartsOptions: { series: [{ type: 'bar' }] },
    },
  });
  render(<WidgetView nodeId={id} />);
  return { rootId, id };
};

/** Every query-bound type merges collectActiveFilters.ts's scan the same way — ag-grid-table and metric-tile get the same indicator as echarts. */
const withNonChartQueryBoundWidget = (
  type: 'ag-grid-table' | 'metric-tile',
) => {
  const rootId = provider.getRoot().id;
  const id = provider.addWidget(rootId, 0, {
    type,
    props: {
      dataBinding: {
        datasetId: CHART_DATASET_ID,
        dimensions: ['region'],
        metrics: [],
      },
    },
  });
  render(<WidgetView nodeId={id} />);
  return { rootId, id };
};

const emitIncomingFilter = (sourceId: string) =>
  provider.emit(sourceId, dashboardApi.VALUE_CHANGED_EVENT, {
    selection: 'west',
    resolved: {
      column: 'region',
      operator: 'EQUALS',
      value: 'west',
      datasource: CHART_DATASET_ID,
    },
  });

test('a chart with nothing filtering it, and nothing of its own active, shows no indicator', async () => {
  const { id } = withChart();
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  expect(
    screen.queryByTestId(`filter-activity-indicator-${id}`),
  ).not.toBeInTheDocument();
});

test('a chart filtered by another widget shows an indicator naming the actual filter, with nothing to click', async () => {
  const { rootId, id } = withChart();
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  // Any node with a resolved value targeting the same dataset is a filter
  // source (see collectActiveFilters.ts) — it doesn't need to be a
  // filter.select, or even be rendered, to count.
  const sourceId = provider.addWidget(rootId, 1, { type: 'echarts' });
  emitIncomingFilter(sourceId);

  const indicator = await screen.findByTestId(
    `filter-activity-indicator-${id}`,
  );
  expect(indicator).toBeVisible();
  // Informational only — clicking it must not do anything, since clearing
  // another widget's own filter isn't this control's to reach into.
  expect(indicator.tagName).toBe('SPAN');
});

test('an ag-grid-table filtered by another widget shows the same indicator', async () => {
  const { rootId, id } = withNonChartQueryBoundWidget('ag-grid-table');

  const sourceId = provider.addWidget(rootId, 1, { type: 'echarts' });
  emitIncomingFilter(sourceId);

  expect(
    await screen.findByTestId(`filter-activity-indicator-${id}`),
  ).toBeVisible();
});

test('a metric-tile filtered by another widget shows the same indicator', async () => {
  const { rootId, id } = withNonChartQueryBoundWidget('metric-tile');

  const sourceId = provider.addWidget(rootId, 1, { type: 'echarts' });
  emitIncomingFilter(sourceId);

  expect(
    await screen.findByTestId(`filter-activity-indicator-${id}`),
  ).toBeVisible();
});

test("a chart's own active cross-filter shows a control naming it, that clears it on click", async () => {
  const { id } = withChart();
  await waitFor(() => expect(mockSetOption).toHaveBeenCalled());

  provider.emit(id, dashboardApi.VALUE_CHANGED_EVENT, {
    selection: 'west',
    resolved: {
      column: 'region',
      operator: 'EQUALS',
      value: 'west',
      datasource: CHART_DATASET_ID,
    },
  });

  const indicator = await screen.findByTestId(
    `filter-activity-indicator-${id}`,
  );
  // ActionButton sets aria-label from its own string `tooltip` prop — the
  // most reliable way to check the actual composed text without fighting
  // antd Tooltip's hover-triggered popup in jsdom. Reads the resolved
  // value back, not a generic message — the whole point of describing
  // filters in the tooltip rather than just a badge.
  expect(indicator).toHaveAttribute(
    'aria-label',
    expect.stringContaining('region = west'),
  );
  fireEvent.click(indicator);

  expect(provider.getValue(id, dashboardApi.VALUE_CHANGED_EVENT)).toEqual({
    selection: null,
    resolved: null,
  });
});
