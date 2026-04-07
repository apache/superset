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
import { Constants } from '@superset-ui/core/components';

const mockColumn = {
  key: 'test-column',
  label: 'Test Column',
  d3format: '.2f',
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ValueCell', () => {
  test('should render positive number', () => {
    const { container } = render(<ValueCell value={300} column={mockColumn} />);

    expect(screen.getByText('300.00')).toBeInTheDocument();
    expect(
      container.querySelector('span[data-value="300"]'),
    ).toBeInTheDocument();
  });

  test('should render negative number', () => {
    const { container } = render(
      <ValueCell value={-123.456} column={mockColumn} />,
    );

    expect(screen.getByText('-123.46')).toBeInTheDocument();
    expect(
      container.querySelector('span[data-value="-123.456"]'),
    ).toBeInTheDocument();
  });

  test('should render zero', () => {
    const { container } = render(<ValueCell value={0} column={mockColumn} />);

    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(container.querySelector('span[data-value="0"]')).toBeInTheDocument();
  });

  test('should render null value', () => {
    render(<ValueCell value={null} column={mockColumn} />);

    expect(screen.getByText(Constants.NULL_DISPLAY)).toBeInTheDocument();
  });

  test('should render number without format', () => {
    const columnWithoutFormat = {
      key: 'test-column',
      label: 'Test Column',
    };

    render(<ValueCell value={300} column={columnWithoutFormat} />);

    expect(screen.getByText('300')).toBeInTheDocument();
  });

  test('should apply color styling when bounds are provided', () => {
    const columnWithBounds = {
      ...mockColumn,
      bounds: [0, 1000] as [number, number],
    };

    const { container } = render(
      <ValueCell value={300} column={columnWithBounds} />,
    );

    const span = container.querySelector('span[data-value="300"] span');
    expect(span).toHaveAttribute(
      'style',
      expect.stringMatching(/color: rgb\([0-9]{1,3}, [0-9]{1,3}, [0-9]{1,3}\)/),
    );
  });

  test('should render null value', () => {
    render(<ValueCell value={null} column={mockColumn} errorMsg='This is an error message' />);

    expect(screen.getByText('This is an error message')).toBeInTheDocument();
  });
});
