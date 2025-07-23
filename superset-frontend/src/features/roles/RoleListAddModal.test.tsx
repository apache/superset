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
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import RoleListAddModal from './RoleListAddModal';
import { createRole } from './utils';

const mockToasts = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
};

jest.mock('./utils');
const mockCreateRole = jest.mocked(createRole);

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: any) => Component,
  useToasts: () => mockToasts,
}));

describe('RoleListAddModal', () => {
  const mockProps = {
    show: true,
    onHide: jest.fn(),
    onSave: jest.fn(),
    permissions: [
      { id: 1, label: 'Permission 1', value: 'Permission_1' },
      { id: 2, label: 'Permission 2', value: 'Permission_2' },
    ],
  };

  it('renders modal with form fields', () => {
    render(<RoleListAddModal {...mockProps} />);
    expect(screen.getByText('Add Role')).toBeInTheDocument();
    expect(screen.getByText('Role Name')).toBeInTheDocument();
    expect(screen.getByText('Permissions')).toBeInTheDocument();
  });

  it('calls onHide when cancel button is clicked', () => {
    render(<RoleListAddModal {...mockProps} />);
    fireEvent.click(screen.getByTestId('modal-cancel-button'));
    expect(mockProps.onHide).toHaveBeenCalled();
  });

  it('disables save button when role name is empty', () => {
    render(<RoleListAddModal {...mockProps} />);
    expect(screen.getByTestId('form-modal-save-button')).toBeDisabled();
  });

  it('enables save button when role name is entered', () => {
    render(<RoleListAddModal {...mockProps} />);
    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'New Role' },
    });
    expect(screen.getByTestId('form-modal-save-button')).toBeEnabled();
  });

  it('calls createRole when save button is clicked', async () => {
    render(<RoleListAddModal {...mockProps} />);

    fireEvent.change(screen.getByTestId('role-name-input'), {
      target: { value: 'New Role' },
    });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockCreateRole).toHaveBeenCalledWith('New Role');
    });
  });
});
