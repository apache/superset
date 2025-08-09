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
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { Checkbox } from '.';
import type { CheckboxProps } from './types';

const mockedProps: CheckboxProps = {
  checked: false,
  id: 'checkbox-id',
  onChange: jest.fn(),
  disabled: false,
  title: 'Checkbox title',
  indeterminate: false,
  children: 'Checkbox Label',
};

describe('Checkbox Component', () => {
  const asyncRender = (props = mockedProps) =>
    waitFor(() => render(<Checkbox {...props} />));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render correctly', async () => {
      const { container } = await asyncRender();
      expect(container).toBeInTheDocument();
    });

    it('should render the label', async () => {
      await asyncRender();
      expect(screen.getByText('Checkbox Label')).toBeInTheDocument();
    });

    it('should render the checkbox', async () => {
      await asyncRender();
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });
  });

  describe('States', () => {
    it('should render as unchecked when checked is false', async () => {
      await asyncRender();
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    it('should render as checked when checked is true', async () => {
      const checkedProps = { ...mockedProps, checked: true };
      await asyncRender(checkedProps);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    it('should render as indeterminate when indeterminate is true', async () => {
      const indeterminateProps = { ...mockedProps, indeterminate: true };
      await asyncRender(indeterminateProps);
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeInTheDocument();
      expect((checkbox as HTMLInputElement).indeterminate).toBe(true);
    });

    it('should render as disabled when disabled prop is true', async () => {
      const disabledProps = { ...mockedProps, disabled: true };
      await asyncRender(disabledProps);
      expect(screen.getByRole('checkbox')).toBeDisabled();
    });
  });

  describe('Interactions', () => {
    it('should call the onChange handler when clicked', async () => {
      await asyncRender();
      const checkbox = screen.getByRole('checkbox');
      await userEvent.click(checkbox);
      expect(mockedProps.onChange).toHaveBeenCalledTimes(1);
    });

    it('should not call the onChange handler when disabled and clicked', async () => {
      const mockOnChange = jest.fn();
      const disabledProps = {
        ...mockedProps,
        disabled: true,
        onChange: mockOnChange,
      };

      await asyncRender(disabledProps);
      const checkbox = screen.getByRole('checkbox');

      await userEvent.click(checkbox);

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('calls onChange handler successfully', async () => {
      const mockAction = jest.fn();
      render(<Checkbox checked={false} onChange={mockAction} />);
      const checkboxInput = screen.getByRole('checkbox');
      await userEvent.click(checkboxInput);
      expect(mockAction).toHaveBeenCalled();
    });
  });
});
