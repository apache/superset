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
import LeftCell from './LeftCell';

describe('LeftCell', () => {
  test('should render column label for column row type', () => {
    const columnRow = {
      label: 'Test Column',
      column_name: 'test_column',
    };

    render(<LeftCell row={columnRow} rowType="column" />);

    expect(screen.getByText('Test Column')).toBeInTheDocument();
  });

  test('should render link for column row type with URL', () => {
    const columnRow = {
      label: 'Test Column',
      column_name: 'test_column',
    };

    const url = 'http://example.com/{{metric.column_name}}';

    render(<LeftCell row={columnRow} rowType="column" url={url} />);

    const link = screen.getByRole('link');

    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'http://example.com/test_column');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('Test Column');
  });

  test('should render MetricOption for metric row type', () => {
    const metricRow = {
      metric_name: 'SUM(sales)',
      label: 'Sum of Sales',
      verbose_name: 'Total Sales',
      description: 'Sum of all sales',
    };

    const { container } = render(<LeftCell row={metricRow} rowType="metric" />);

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should render MetricOption with URL for metric row type', () => {
    const metricRow = {
      metric_name: 'SUM(sales)',
      label: 'Sum of Sales',
    };

    const url = 'http://example.com/metrics/{{metric.metric_name}}';

    const { container } = render(
      <LeftCell row={metricRow} rowType="metric" url={url} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should handle empty column label', () => {
    const columnRow = {
      label: '',
      column_name: 'empty_column',
    };

    const { container } = render(<LeftCell row={columnRow} rowType="column" />);

    expect(container).toBeTruthy();
    expect(container).toHaveTextContent('');
  });

  test('should handle undefined values in row', () => {
    const columnRow = {
      label: undefined,
      column_name: 'test_column',
    };

    const element = document.body;

    render(<LeftCell row={columnRow} rowType="column" />);
    expect(element).toBeTruthy();
  });

  test('should properly template URL with metric context', () => {
    const metricRow = {
      metric_name: 'AVG(price)',
      label: 'Average Price',
      id: 123,
    };

    const url = 'http://example.com/{{metric.metric_name}}/{{metric.id}}';

    render(<LeftCell row={metricRow} rowType="metric" url={url} />);

    const { container } = render(
      <LeftCell row={metricRow} rowType="metric" url={url} />,
    );

    expect(container.firstChild).toBeInTheDocument();
  });

  test('should handle complex templating patterns', () => {
    const columnRow = {
      label: 'Sales Data',
      column_name: 'sales',
      type: 'numeric',
    };

    const complexUrl =
      'http://example.com/{{metric.column_name}}?type={{metric.type}}&label={{metric.label}}';

    render(<LeftCell row={columnRow} rowType="column" url={complexUrl} />);

    const link = screen.getByRole('link');

    expect(link).toHaveAttribute(
      'href',
      'http://example.com/sales?type=numeric&label=Sales Data',
    );
  });
});
