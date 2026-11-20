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
import { hierarchy } from 'd3-hierarchy';
import Partition, {
  init,
  PartitionDataNode,
  PartitionNode,
} from '../src/Partition';

// Mirrors the uneven-branching repro from #43727: category "B" has no
// sub_subcategory (terminates one level shallower than "A"), which used to
// be enough to throw off the shared "previous node" traversal heuristic.
function buildUnevenTree(): PartitionDataNode {
  return {
    name: 'Metric',
    val: 4,
    children: [
      {
        name: 'B',
        val: 2,
        children: [{ name: 'B1', val: 2 }],
      },
      {
        name: 'A',
        val: 2,
        children: [
          {
            name: 'A1',
            val: 2,
            children: [
              { name: 'A1a', val: 1 },
              { name: 'A1b', val: 1 },
            ],
          },
        ],
      },
    ],
  };
}

function buildInitializedNodes(data: PartitionDataNode): PartitionNode[] {
  const root = hierarchy<PartitionDataNode>(data) as unknown as PartitionNode;
  // Populate the name/weight/sum fields init() relies on, the same way
  // Icicle's drawVis does before calling init(). Without this, every
  // node's `name` stays undefined and byName lookups below collapse to a
  // single key.
  root.eachAfter(n => {
    n.name = Array.isArray(n.data.name)
      ? n.data.name[n.data.name.length - 1]
      : n.data.name;
    n.weight = n.data.val;
  });
  root.eachAfter(n => {
    n.sum = n.children ? n.children.reduce((a, v) => a + v.weight, 0) || 1 : 1;
  });

  return init(root);
}

test('keeps every node within its own parent band, even when a sibling branch terminates early', () => {
  const nodes = buildInitializedNodes(buildUnevenTree());

  nodes.forEach(n => {
    if (!n.parent) return;
    expect(n.x).toBeGreaterThanOrEqual(n.parent.x - 1e-9);
    expect(n.x + n.dx).toBeLessThanOrEqual(n.parent.x + n.parent.dx + 1e-9);
  });
});

test('positions descendants of the deeper branch relative to their true ancestors', () => {
  const nodes = buildInitializedNodes(buildUnevenTree());
  const byName = Object.fromEntries(nodes.map(n => [n.name, n]));

  // Before the fix, A1a/A1b were reset to x=0 (B's band) instead of being
  // positioned within A1's band, because the first node reached at depth 3
  // belonged to A -- the branch that kept going -- not to B, the first
  // branch visited in breadth-first order.
  expect(byName.A1a.x).toBeCloseTo(byName.A1.x);
  expect(byName.A1b.x).toBeCloseTo(byName.A1.x + byName.A1a.dx);
});

const CHART_WIDTH = 400;
const CHART_HEIGHT = 300;
const DEFAULT_TOOLTIP_WIDTH = 120;
const TOOLTIP_OFFSET = 15;

const props = {
  width: CHART_WIDTH,
  height: CHART_HEIGHT,
  data: [
    {
      name: 'sum__num',
      val: 100,
      children: [
        { name: 'boy', val: 60 },
        { name: 'girl', val: 40 },
      ],
    },
  ],
  colorScheme: 'supersetColors',
  dateTimeFormat: '%Y-%m-%d',
  equalDateSize: true,
  levels: ['gender'],
  metrics: ['sum__num'],
  numberFormat: ',d',
  partitionLimit: 0,
  partitionThreshold: 0,
  timeSeriesOption: 'not_time',
  useLogScale: false,
  useRichTooltip: false,
  sliceId: 1,
};

let container: HTMLDivElement;
let tooltipWidth = DEFAULT_TOOLTIP_WIDTH;
let rectSpy: jest.SpyInstance;
let offsetWidthSpy: jest.SpyInstance;

beforeEach(() => {
  tooltipWidth = DEFAULT_TOOLTIP_WIDTH;
  container = document.createElement('div');
  document.body.appendChild(container);
  // jsdom performs no layout: give the container a fixed box so the
  // pointer coordinates d3.mouse() derives from clientX are deterministic.
  rectSpy = jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function getRect(this: HTMLElement) {
      const isTooltip = this.classList.contains('partition-tooltip');
      const width = isTooltip ? tooltipWidth : CHART_WIDTH;

      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: CHART_HEIGHT,
        width,
        height: CHART_HEIGHT,
        toJSON: () => ({}),
      } as DOMRect;
    });
  offsetWidthSpy = jest
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function getOffsetWidth(this: HTMLElement) {
      return this.classList.contains('partition-tooltip')
        ? tooltipWidth
        : CHART_WIDTH;
    });
});

afterEach(() => {
  rectSpy.mockRestore();
  offsetWidthSpy.mockRestore();
  container.remove();
});

function hoverAt(clientX: number, clientY: number): HTMLElement {
  Partition(container, props);
  const node = container.querySelector('svg g rect') as SVGRectElement;
  node.dispatchEvent(
    new MouseEvent('mousemove', { bubbles: true, clientX, clientY }),
  );

  return container.querySelector('.partition-tooltip') as HTMLElement;
}

test('places the tooltip right of the cursor when there is room', () => {
  const tooltip = hoverAt(50, 100);

  expect(tooltip.style.left).toBe(`${50 + TOOLTIP_OFFSET}px`);
  expect(tooltip.style.top).toBe('100px');
});

test('keeps the tooltip inside the chart when hovering near the right edge', () => {
  const cursorX = CHART_WIDTH - 10;
  const tooltip = hoverAt(cursorX, 100);

  const left = parseFloat(tooltip.style.left);
  expect(left + tooltipWidth).toBeLessThanOrEqual(CHART_WIDTH);
  // shifted to the left of the cursor rather than overlapping it
  expect(left + tooltipWidth).toBeLessThanOrEqual(cursorX);
});

test('clamps the tooltip to the chart origin when it is wider than the chart', () => {
  tooltipWidth = CHART_WIDTH + 100;
  const tooltip = hoverAt(CHART_WIDTH / 2, 100);

  expect(parseFloat(tooltip.style.left)).toBe(0);
});
