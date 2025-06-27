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
import { fireEvent, render } from '@superset-ui/core/spec';
import { EditableTitle } from '.';

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
  const { getByTestId } = render(<EditableTitle {...mockProps} />);
  const textArea = getByTestId('textarea-editable-title-input');

  expect(textArea).toBeInTheDocument();
  expect(textArea).toHaveValue(mockProps.title);
});

test('should not render an input if it is not editable', () => {
  const { queryByTestId } = render(
    <EditableTitle title="my title" onSaveTitle={jest.fn()} />,
  );
  expect(
    queryByTestId('textarea-editable-title-input'),
  ).not.toBeInTheDocument();
});

describe('should handle click', () => {
  it('should enable editing mode on click', () => {
    const { getByTestId, container } = render(<EditableTitle {...mockProps} />);

    fireEvent.click(getByTestId('textarea-editable-title-input'));
    expect(container.querySelector('textarea')).toHaveClass(
      'ant-input-outlined',
    );
  });
});

describe('should handle change', () => {
  it('should change title', () => {
    const { getByTestId } = render(<EditableTitle {...mockProps} editing />);
    const textarea = getByTestId('textarea-editable-title-input');
    fireEvent.change(textarea, mockEvent);
    expect(textarea).toHaveValue('new title');
  });
});

describe('should handle blur', () => {
  const setup = (overrides: Partial<typeof mockProps> = {}) => {
    const selectors = render(<EditableTitle {...mockProps} {...overrides} />);
    fireEvent.click(selectors.getByTestId('textarea-editable-title-input'));
    return selectors;
  };

  it('should trigger callback', () => {
    const callback = jest.fn();
    const { getByTestId } = setup({ onSaveTitle: callback });
    fireEvent.change(getByTestId('textarea-editable-title-input'), mockEvent);
    fireEvent.blur(getByTestId('textarea-editable-title-input'));
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('new title');
  });

  it('should not trigger callback', () => {
    const callback = jest.fn();
    const { getByTestId } = setup({ onSaveTitle: callback });
    fireEvent.blur(getByTestId('textarea-editable-title-input'));
    // no change
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not save empty title', () => {
    const callback = jest.fn();
    const { getByTestId } = setup({ onSaveTitle: callback });
    const textarea = getByTestId('textarea-editable-title-input');
    fireEvent.blur(textarea);

    expect(textarea).toHaveValue(mockProps.title);
    expect(callback).not.toHaveBeenCalled();
  });
});
