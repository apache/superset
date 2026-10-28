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
import { render, screen } from '../../../../spec/helpers/testing-library';
import TimeseriesLegend from '../../src/Timeseries/TimeseriesLegend';
import { LegendOrientation } from '../../src/types';

const baseItems = [
  { color: '#ff0000', interactive: true, name: 'Alpha', selected: true },
  { color: '#00ff00', interactive: true, name: 'Beta', selected: false },
];

const baseProps = {
  grid: { bottom: 20, top: 20 },
  items: baseItems,
  maxHeight: 200,
  onAll: jest.fn(),
  onHover: jest.fn(),
  onInverse: jest.fn(),
  onToggle: jest.fn(),
  showSelectors: false,
};

test('renders items for a top-oriented legend', () => {
  render(
    <TimeseriesLegend {...baseProps} orientation={LegendOrientation.Top} />,
  );

  expect(screen.getByTestId('timeseries-custom-legend')).toHaveStyle({
    maxHeight: '200px',
  });
  expect(screen.getByText('Alpha')).toBeInTheDocument();
  expect(screen.getByText('Beta')).toBeInTheDocument();
});

test.each([LegendOrientation.Left, LegendOrientation.Right])(
  'stacks and truncates items for a %s-oriented legend',
  orientation => {
    render(
      <TimeseriesLegend
        {...baseProps}
        maxWidth={120}
        orientation={orientation}
      />,
    );

    const legend = screen.getByTestId('timeseries-custom-legend');
    expect(legend).toHaveStyle({ maxWidth: '120px', width: 'auto' });
    expect(legend.querySelector('ul')).toHaveStyle({
      flexDirection: 'column',
      flexWrap: 'nowrap',
    });
    expect(screen.getByText('Alpha')).toHaveStyle({
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  },
);

test('omits row-break sentinels from a vertical legend', () => {
  render(
    <TimeseriesLegend
      {...baseProps}
      items={[
        ...baseItems,
        { color: '', interactive: false, name: '', selected: true },
      ]}
      maxWidth={120}
      orientation={LegendOrientation.Left}
    />,
  );

  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('keeps row-break sentinels in a horizontal legend', () => {
  render(
    <TimeseriesLegend
      {...baseProps}
      items={[
        ...baseItems,
        { color: '', interactive: false, name: '', selected: true },
      ]}
      orientation={LegendOrientation.Top}
    />,
  );

  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

test('renders nothing when a vertical legend has no width to fill', () => {
  const { container } = render(
    <TimeseriesLegend
      {...baseProps}
      maxWidth={0}
      orientation={LegendOrientation.Left}
    />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('renders nothing when the item list is empty', () => {
  const { container } = render(
    <TimeseriesLegend
      {...baseProps}
      items={[]}
      orientation={LegendOrientation.Top}
    />,
  );

  expect(container).toBeEmptyDOMElement();
});

test('titles truncated vertical labels and leaves wrapping labels untitled', () => {
  const { unmount } = render(
    <TimeseriesLegend
      {...baseProps}
      maxWidth={120}
      orientation={LegendOrientation.Left}
    />,
  );

  expect(screen.getByText('Alpha')).toHaveAttribute('title', 'Alpha');
  unmount();

  render(
    <TimeseriesLegend {...baseProps} orientation={LegendOrientation.Top} />,
  );

  expect(screen.getByText('Alpha')).not.toHaveAttribute('title');
});
