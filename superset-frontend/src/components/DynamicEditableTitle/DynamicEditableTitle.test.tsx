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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { DynamicEditableTitle } from '.';

const createProps = (overrides: Record<string, any> = {}) => ({
  title: 'Chart title',
  placeholder: 'Add the name of the chart',
  canEdit: true,
  onSave: jest.fn(),
  label: 'Chart title',
  ...overrides,
});

describe('Chart editable title', () => {
  it('renders chart title', () => {
    const props = createProps();
    render(<DynamicEditableTitle {...props} />);
    expect(screen.getByText('Chart title')).toBeVisible();
  });

  it('renders placeholder', () => {
    const props = createProps({
      title: '',
    });
    render(<DynamicEditableTitle {...props} />);
    expect(screen.getByText('Add the name of the chart')).toBeVisible();
  });

  it('click, edit and save title', () => {
    const props = createProps();
    render(<DynamicEditableTitle {...props} />);
    const textboxElement = screen.getByRole('textbox');
    userEvent.click(textboxElement);
    userEvent.type(textboxElement, ' edited');
    expect(screen.getByText('Chart title edited')).toBeVisible();
    userEvent.type(textboxElement, '{enter}');
    expect(props.onSave).toHaveBeenCalled();
  });

  it('renders in non-editable mode', () => {
    const props = createProps({ canEdit: false });
    render(<DynamicEditableTitle {...props} />);
    const titleElement = screen.getByLabelText('Chart title');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(titleElement).toBeVisible();
    userEvent.click(titleElement);
    userEvent.type(titleElement, ' edited{enter}');
    expect(props.onSave).not.toHaveBeenCalled();
  });
});
