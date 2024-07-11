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
import {
  columns,
  metrics,
} from 'src/explore/components/DatasourcePanel/fixtures';
import { fireEvent, render, within } from 'spec/helpers/testing-library';
import DatasourcePanelItem from './DatasourcePanelItem';

const mockData = {
  metricSlice: metrics,
  columnSlice: columns,
  totalMetrics: Math.max(metrics.length, 10),
  totalColumns: Math.max(columns.length, 13),
  width: 300,
  showAllMetrics: false,
  onShowAllMetricsChange: jest.fn(),
  showAllColumns: false,
  onShowAllColumnsChange: jest.fn(),
  collapseMetrics: false,
  onCollapseMetricsChange: jest.fn(),
  collapseColumns: false,
  onCollapseColumnsChange: jest.fn(),
  hiddenMetricCount: 0,
  hiddenColumnCount: 0,
};

test('renders each item accordingly', () => {
  const { getByText, getByTestId, rerender, container } = render(
    <DatasourcePanelItem index={0} data={mockData} style={{}} />,
    { useDnd: true },
  );

  expect(getByText('Metrics')).toBeInTheDocument();
  rerender(<DatasourcePanelItem index={1} data={mockData} style={{}} />);
  expect(
    getByText(
      `Showing ${mockData.metricSlice.length} of ${mockData.totalMetrics}`,
    ),
  ).toBeInTheDocument();
  mockData.metricSlice.forEach((metric, metricIndex) => {
    rerender(
      <DatasourcePanelItem
        index={metricIndex + 2}
        data={mockData}
        style={{}}
      />,
    );
    expect(getByTestId('DatasourcePanelDragOption')).toBeInTheDocument();
    expect(
      within(getByTestId('DatasourcePanelDragOption')).getByText(
        metric.metric_name,
      ),
    ).toBeInTheDocument();
  });
  rerender(
    <DatasourcePanelItem
      index={2 + mockData.metricSlice.length}
      data={mockData}
      style={{}}
    />,
  );
  expect(container).toHaveTextContent('');

  const startIndexOfColumnSection = mockData.metricSlice.length + 3;
  rerender(
    <DatasourcePanelItem
      index={startIndexOfColumnSection}
      data={mockData}
      style={{}}
    />,
  );
  expect(getByText('Columns')).toBeInTheDocument();
  rerender(
    <DatasourcePanelItem
      index={startIndexOfColumnSection + 1}
      data={mockData}
      style={{}}
    />,
  );
  expect(
    getByText(
      `Showing ${mockData.columnSlice.length} of ${mockData.totalColumns}`,
    ),
  ).toBeInTheDocument();
  mockData.columnSlice.forEach((column, columnIndex) => {
    rerender(
      <DatasourcePanelItem
        index={startIndexOfColumnSection + columnIndex + 2}
        data={mockData}
        style={{}}
      />,
    );
    expect(getByTestId('DatasourcePanelDragOption')).toBeInTheDocument();
    expect(
      within(getByTestId('DatasourcePanelDragOption')).getByText(
        column.column_name,
      ),
    ).toBeInTheDocument();
  });
});

test('can collapse metrics and columns', () => {
  mockData.onCollapseMetricsChange.mockClear();
  mockData.onCollapseColumnsChange.mockClear();
  const { queryByText, getByRole, rerender } = render(
    <DatasourcePanelItem index={0} data={mockData} style={{}} />,
    { useDnd: true },
  );
  fireEvent.click(getByRole('button'));
  expect(mockData.onCollapseMetricsChange).toBeCalled();
  expect(mockData.onCollapseColumnsChange).not.toBeCalled();

  const startIndexOfColumnSection = mockData.metricSlice.length + 3;
  rerender(
    <DatasourcePanelItem
      index={startIndexOfColumnSection}
      data={mockData}
      style={{}}
    />,
  );
  fireEvent.click(getByRole('button'));
  expect(mockData.onCollapseColumnsChange).toBeCalled();

  rerender(
    <DatasourcePanelItem
      index={1}
      data={{
        ...mockData,
        collapseMetrics: true,
      }}
      style={{}}
    />,
  );
  expect(
    queryByText(
      `Showing ${mockData.metricSlice.length} of ${mockData.totalMetrics}`,
    ),
  ).not.toBeInTheDocument();

  rerender(
    <DatasourcePanelItem
      index={2}
      data={{
        ...mockData,
        collapseMetrics: true,
      }}
      style={{}}
    />,
  );
  expect(queryByText('Columns')).toBeInTheDocument();
});

test('shows ineligible items count', () => {
  const hiddenColumnCount = 3;
  const hiddenMetricCount = 1;
  const dataWithHiddenItems = {
    ...mockData,
    hiddenColumnCount,
    hiddenMetricCount,
  };
  const { getByText, rerender } = render(
    <DatasourcePanelItem index={1} data={dataWithHiddenItems} style={{}} />,
    { useDnd: true },
  );
  expect(
    getByText(`${hiddenMetricCount} ineligible item(s) are hidden`),
  ).toBeInTheDocument();

  const startIndexOfColumnSection = mockData.metricSlice.length + 3;
  rerender(
    <DatasourcePanelItem
      index={startIndexOfColumnSection + 1}
      data={dataWithHiddenItems}
      style={{}}
    />,
  );
  expect(
    getByText(`${hiddenColumnCount} ineligible item(s) are hidden`),
  ).toBeInTheDocument();
});
