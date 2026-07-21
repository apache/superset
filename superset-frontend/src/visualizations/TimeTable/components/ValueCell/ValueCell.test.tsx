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
import ValueCell from './ValueCell';

const mockColumn = {
  key: 'test-column',
  label: 'Test Column',
  d3format: '.2f',
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ValueCell', () => {
  test('should render a formatted value', () => {
    render(<ValueCell value={300} column={mockColumn} />);

    expect(screen.getByText('300.00')).toBeInTheDocument();
  });

  test('should render decimal values', () => {
    render(<ValueCell value={1.5} column={mockColumn} />);

    expect(screen.getByText('1.50')).toBeInTheDocument();
  });

  test('should render zero', () => {
    render(<ValueCell value={0} column={mockColumn} />);

    expect(screen.getByText('0.00')).toBeInTheDocument();
  });

  test('should render negative values', () => {
    render(<ValueCell value={-200} column={mockColumn} />);

    expect(screen.getByText('-200.00')).toBeInTheDocument();
  });

  test('should render an error message instead of the value', () => {
    render(
      <ValueCell
        value={null}
        errorMsg="The time lag set at 10 is too large"
        column={mockColumn}
      />,
    );

    expect(
      screen.getByText(/The time lag set at 10 is too large/),
    ).toBeInTheDocument();
  });

  test('should apply color styling when bounds are provided', () => {
    const columnWithBounds = {
      ...mockColumn,
      bounds: [0, 1000] as [number, number],
    };

    const { container } = render(
      <ValueCell value={300} column={columnWithBounds} />,
    );

    const span = container.querySelector('span[data-value="300"]');

    expect(span).toBeInTheDocument();
  });
});
