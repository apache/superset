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
import '@testing-library/jest-dom';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import TimeseriesLegendIcon from '../../src/Timeseries/TimeseriesLegendIcon';
import TimeseriesLegend from '../../src/Timeseries/TimeseriesLegend';
import { LegendOrientation } from '../../src/types';
import type {
  TimeseriesLegendIcon as LegendIcon,
  TimeseriesLegendItem,
  TimeseriesLegendLineType,
} from '../../src/Timeseries/types';

const COLOR = '#1f77b4';
const DISABLED = supersetTheme.colorTextDisabled;

function renderIcon(icon: LegendIcon, selected = true) {
  return render(
    <ThemeProvider theme={supersetTheme}>
      <TimeseriesLegendIcon color={COLOR} icon={icon} selected={selected} />
    </ThemeProvider>,
  ).container;
}

function lineIcon(
  overrides: Partial<Extract<LegendIcon, { shape: 'line' }>> = {},
): LegendIcon {
  return {
    shape: 'line',
    lineType: 'solid',
    lineWidth: 2,
    opacity: 1,
    symbol: 'emptyCircle',
    ...overrides,
  };
}

test('sizes the icon like the ECharts legend item and hides it from readers', () => {
  const svg = renderIcon({ shape: 'box', opacity: 1 }).querySelector('svg');

  expect(svg).toHaveAttribute('width', '25');
  expect(svg).toHaveAttribute('height', '14');
  expect(svg).toHaveAttribute('viewBox', '0 0 25 14');
  expect(svg).toHaveAttribute('aria-hidden', 'true');
});

test('draws a box icon as the rounded bar the ECharts legend uses', () => {
  const container = renderIcon({ shape: 'box', opacity: 1 });
  const rect = container.querySelector('rect');

  expect(rect).toHaveAttribute('width', '25');
  expect(rect).toHaveAttribute('height', '14');
  expect(rect).toHaveAttribute('rx', '3.5');
  expect(rect).toHaveAttribute('fill', COLOR);
  expect(container.querySelector('line')).toBeNull();
  expect(container.querySelector('circle')).toBeNull();
});

test('draws a line icon as a full-width stroke with the symbol centred on it', () => {
  const container = renderIcon(lineIcon());
  const line = container.querySelector('line');
  const symbol = container.querySelector('circle');

  expect(line).toHaveAttribute('x1', '0');
  expect(line).toHaveAttribute('x2', '25');
  expect(line).toHaveAttribute('y1', '7');
  expect(line).toHaveAttribute('y2', '7');
  expect(line).toHaveAttribute('stroke', COLOR);
  expect(line).toHaveAttribute('stroke-width', '2');
  expect(line).not.toHaveAttribute('stroke-dasharray');
  // Symbol is 80% of the item height, as in ECharts' line legend icon.
  expect(symbol).toHaveAttribute('cx', '12.5');
  expect(symbol).toHaveAttribute('cy', '7');
  expect(symbol).toHaveAttribute('r', '5.6');
});

test('draws empty symbols hollow: background fill with a coloured outline', () => {
  const symbol = renderIcon(lineIcon()).querySelector('circle');

  expect(symbol).toHaveAttribute('fill', supersetTheme.colorBgContainer);
  expect(symbol).toHaveAttribute('stroke', COLOR);
  expect(symbol).toHaveAttribute('stroke-width', '2');
});

test('draws filled symbols without an outline', () => {
  const symbol = renderIcon(lineIcon({ symbol: 'circle' })).querySelector(
    'circle',
  );

  expect(symbol).toHaveAttribute('fill', COLOR);
  expect(symbol).not.toHaveAttribute('stroke');
});

test.each<[TimeseriesLegendLineType, string]>([
  ['dashed', '8 4'],
  ['dotted', '2'],
  [[6, 15], '6 15'],
  [[20, 3], '20 3'],
])(
  'dashes the line for the %j line type the way zrender does',
  (lineType, dash) => {
    const line = renderIcon(lineIcon({ lineType })).querySelector('line');

    expect(line).toHaveAttribute('stroke-dasharray', dash);
  },
);

test('omits the line but keeps the symbol when the series hides its line', () => {
  const container = renderIcon(lineIcon({ lineWidth: 0 }));

  expect(container.querySelector('line')).toBeNull();
  expect(container.querySelector('circle')).not.toBeNull();
});

test.each([
  ['rect', 'rect', { x: '6.9', y: '1.4', width: '11.2', height: '11.2' }],
  ['roundRect', 'rect', { rx: '2.8', width: '11.2', height: '11.2' }],
  ['triangle', 'polygon', { points: '12.5,1.4 18.1,12.6 6.9,12.6' }],
  ['diamond', 'polygon', { points: '12.5,1.4 18.1,7 12.5,12.6 6.9,7' }],
  ['arrow', 'rect', { width: '11.2', height: '11.2' }],
])(
  'draws the %s symbol as a %s with ECharts geometry',
  (symbol, element, attributes) => {
    const container = renderIcon(lineIcon({ symbol }));
    const node = container.querySelector(`line ~ ${element}`);

    expect(node).not.toBeNull();
    Object.entries(attributes).forEach(([name, value]) => {
      expect(node).toHaveAttribute(name, value);
    });
    expect(node).toHaveAttribute('fill', COLOR);
  },
);

test('draws the pin symbol as a teardrop with its tip on the line and its head above it', () => {
  const container = renderIcon(lineIcon({ symbol: 'pin' }));
  const path = container.querySelector('path');
  const d = path?.getAttribute('d') ?? '';

  expect(path).toHaveAttribute('fill', COLOR);
  // ECharts puts the cusp at the symbol centre, so the tip sits on the line.
  expect(d).toContain(' 12.5,7 C');
  // The head is a circle 3/10 of the symbol size, centred above the line.
  expect(d).toContain('A3.36,3.36 0 1 1');
  expect(d).toMatch(/^M9\.46,2\.04 /);
  // The head pokes above the 14px box, so the svg must not clip it.
  expect(container.querySelector('svg')).toHaveStyle({ overflow: 'visible' });
});

test('applies the series opacity to the whole icon', () => {
  expect(
    renderIcon(lineIcon({ opacity: 0.7 })).querySelector('svg'),
  ).toHaveAttribute('opacity', '0.7');
  expect(
    renderIcon({ shape: 'box', opacity: 0.5 }).querySelector('svg'),
  ).toHaveAttribute('opacity', '0.5');
});

test('draws a hollow rect for emptyRect', () => {
  const rect = renderIcon(lineIcon({ symbol: 'emptyRect' })).querySelector(
    'line ~ rect',
  );

  expect(rect).toHaveAttribute('fill', supersetTheme.colorBgContainer);
  expect(rect).toHaveAttribute('stroke', COLOR);
});

test('draws a symbol icon at the full item height with no line', () => {
  const container = renderIcon({
    shape: 'symbol',
    opacity: 1,
    symbol: 'circle',
  });
  const symbol = container.querySelector('circle');

  expect(container.querySelector('line')).toBeNull();
  expect(symbol).toHaveAttribute('cx', '12.5');
  expect(symbol).toHaveAttribute('cy', '7');
  expect(symbol).toHaveAttribute('r', '7');
  expect(symbol).toHaveAttribute('fill', COLOR);
});

test('paints a deselected item in the disabled colour, like an inactive ECharts legend item', () => {
  const box = renderIcon({ shape: 'box', opacity: 1 }, false).querySelector(
    'rect',
  );
  const lineContainer = renderIcon(lineIcon(), false);

  expect(box).toHaveAttribute('fill', DISABLED);
  expect(lineContainer.querySelector('line')).toHaveAttribute(
    'stroke',
    DISABLED,
  );
  expect(lineContainer.querySelector('circle')).toHaveAttribute(
    'stroke',
    DISABLED,
  );
});

test('TimeseriesLegend draws one icon per item and none for row breaks', () => {
  const items: TimeseriesLegendItem[] = [
    {
      color: COLOR,
      icon: lineIcon({ lineType: 'dashed' }),
      interactive: true,
      name: 'Reporting limit',
      selected: true,
    },
    {
      color: COLOR,
      icon: { shape: 'box', opacity: 1 },
      interactive: false,
      name: '',
      selected: true,
    },
    {
      color: '#ff7f0e',
      icon: { shape: 'box', opacity: 1 },
      interactive: true,
      name: 'Sales',
      selected: false,
    },
  ];
  const { container } = render(
    <ThemeProvider theme={supersetTheme}>
      <TimeseriesLegend
        grid={{ bottom: 20, top: 20 }}
        items={items}
        maxHeight={100}
        onAll={jest.fn()}
        onInverse={jest.fn()}
        onToggle={jest.fn()}
        orientation={LegendOrientation.Top}
        showSelectors={false}
      />
    </ThemeProvider>,
  );

  const icons = container.querySelectorAll('svg');
  expect(icons).toHaveLength(2);
  expect(icons[0].querySelector('line')).toHaveAttribute(
    'stroke-dasharray',
    '8 4',
  );
  expect(icons[1].querySelector('rect')).toHaveAttribute('fill', DISABLED);
});

test('TimeseriesLegend labels use the colours the ECharts legend theme uses', () => {
  const { getByRole } = render(
    <ThemeProvider theme={supersetTheme}>
      <TimeseriesLegend
        grid={{ bottom: 20, top: 20 }}
        items={[
          {
            color: COLOR,
            icon: { shape: 'box', opacity: 1 },
            interactive: true,
            name: 'Shown',
            selected: true,
          },
          {
            color: COLOR,
            icon: { shape: 'box', opacity: 1 },
            interactive: true,
            name: 'Hidden',
            selected: false,
          },
        ]}
        maxHeight={100}
        onAll={jest.fn()}
        onInverse={jest.fn()}
        onToggle={jest.fn()}
        orientation={LegendOrientation.Top}
        showSelectors={false}
      />
    </ThemeProvider>,
  );

  // Echart.tsx themes legend.textStyle with colorTextSecondary and inactive
  // items with colorTextDisabled; the HTML legend must read the same.
  expect(getByRole('button', { name: 'Shown' })).toHaveStyle({
    color: supersetTheme.colorTextSecondary,
  });
  expect(getByRole('button', { name: 'Hidden' })).toHaveStyle({
    color: DISABLED,
  });
});
