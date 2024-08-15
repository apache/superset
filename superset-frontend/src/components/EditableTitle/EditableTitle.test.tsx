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
import { fireEvent, getByRole, render } from 'spec/helpers/testing-library';

import EditableTable from 'src/components/EditableTitle';

const mockEvent = {
  target: {
    value: 'new title',
  },
};
const mockProps = {
  title: 'my title',
  canEdit: true,
  onSaveTitle: jest.fn(),
};

test('should render title', () => {
  const { getByRole } = render(<EditableTable {...mockProps} />);
  expect(getByRole('button')).toBeInTheDocument();
  expect(getByRole('button')).toHaveValue(mockProps.title);
});
test('should not render an input if it is not editable', () => {
  const { queryByRole } = render(
    <EditableTable title="my title" onSaveTitle={jest.fn()} />,
  );
  expect(queryByRole('button')).not.toBeInTheDocument();
});

describe('should handle click', () => {
  test('should change title', () => {
    const { getByRole, container } = render(<EditableTable {...mockProps} />);
    fireEvent.click(getByRole('button'));
    expect(container.querySelector('input')?.getAttribute('type')).toEqual(
      'text',
    );
  });
});

describe('should handle change', () => {
  test('should change title', () => {
    const { getByTestId, container } = render(
      <EditableTable {...mockProps} editing />,
    );
    fireEvent.change(getByTestId('editable-title-input'), mockEvent);
    expect(container.querySelector('input')).toHaveValue('new title');
  });
});

describe('should handle blur', () => {
  const setup = (overrides: Partial<typeof mockProps> = {}) => {
    const selectors = render(<EditableTable {...mockProps} {...overrides} />);
    fireEvent.click(selectors.getByRole('button'));
    return selectors;
  };

  test('default input type should be text', () => {
    const { container } = setup();
    expect(container.querySelector('input')?.getAttribute('type')).toEqual(
      'text',
    );
  });

  test('should trigger callback', () => {
    const callback = jest.fn();
    const { getByTestId, container } = setup({ onSaveTitle: callback });
    fireEvent.change(getByTestId('editable-title-input'), mockEvent);
    fireEvent.blur(getByTestId('editable-title-input'));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('new title');
    expect(container.querySelector('input')?.getAttribute('type')).toEqual(
      'button',
    );
  });

  test('should not trigger callback', () => {
    const callback = jest.fn();
    const { getByTestId, container } = setup({ onSaveTitle: callback });
    fireEvent.blur(getByTestId('editable-title-input'));
    expect(container.querySelector('input')?.getAttribute('type')).toEqual(
      'button',
    );
    // no change
    expect(callback).not.toHaveBeenCalled();
  });

  test('should not save empty title', () => {
    const callback = jest.fn();
    const { getByTestId, container } = setup({ onSaveTitle: callback });
    fireEvent.blur(getByTestId('editable-title-input'));
    expect(container.querySelector('input')?.getAttribute('type')).toEqual(
      'button',
    );
    expect(getByRole(container, 'button')).toHaveValue(mockProps.title);
    expect(callback).not.toHaveBeenCalled();
  });
});
