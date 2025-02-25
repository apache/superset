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
import React from 'react';
import fetchMock from 'fetch-mock';
import { render, screen, userEvent, within } from 'spec/helpers/testing-library';
import CssTemplateModal from './CssTemplateModal';
import { TemplateObject } from './types';

jest.mock('src/components/AsyncAceEditor', () => ({
  CssEditor: ({ onChange, value }: { onChange: Function; value: string }) => (
    <textarea
      data-test="css-editor"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

jest.mock('src/components/Icons', () => ({
  EditAlt: () => <span data-test="edit-alt">EditAlt</span>,
  PlusLarge: () => <span data-test="plus-large">PlusLarge</span>,
}));

const mockData = { id: 1, template_name: 'test', css: 'body { color: red; }' };
const FETCH_CSS_TEMPLATE_ENDPOINT = 'glob:*/api/v1/css_template/*';
const CSS_TEMPLATE_PAYLOAD = { result: mockData };

fetchMock.get(FETCH_CSS_TEMPLATE_ENDPOINT, CSS_TEMPLATE_PAYLOAD);

const mockedProps = {
  addDangerToast: jest.fn(),
  onCssTemplateAdd: jest.fn(() => []),
  onHide: jest.fn(),
  show: true,
  cssTemplate: mockData,
};

interface RenderModalProps {
  cssTemplate?: TemplateObject | null;
}

const renderModal = (props: RenderModalProps = {}) => {
  return render(<CssTemplateModal {...mockedProps} {...props} />, {
    useRedux: true,
  });
};

describe('CssTemplateModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.resetHistory();
  });

  it('renders the modal', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders add header when no css template is included', () => {
    renderModal({ cssTemplate: null });
    expect(screen.getByTestId('css-template-modal-title')).toHaveTextContent(
      'Add CSS template',
    );
  });

  it('renders edit header when css template prop is included', () => {
    renderModal();
    expect(screen.getByTestId('css-template-modal-title')).toHaveTextContent(
      'Edit CSS template properties',
    );
  });

  it('renders input elements for template name', () => {
    renderModal();
    const nameInput = screen.getByRole('textbox', { name: /name/i });
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('name', 'template_name');
    expect(nameInput).toHaveAttribute('type', 'text');
  });

  it('renders css editor', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const cssContainer = within(dialog).getByText('css').closest('.control-label');
    expect(cssContainer).toBeInTheDocument();
    const requiredIndicator = within(cssContainer as HTMLElement).getByText('*');
    expect(requiredIndicator).toHaveClass('required');
  });

  it('shows required indicators', () => {
    renderModal();
    const requiredIndicators = screen.getAllByText('*');
    expect(requiredIndicators).toHaveLength(2); // Name and CSS fields
    requiredIndicators.forEach(indicator => {
      expect(indicator).toHaveClass('required');
    });
  });

  it('shows "Add" button in create mode', () => {
    renderModal({ cssTemplate: null });
    const addButton = screen.getByRole('button', { name: 'Add' });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled(); // Initially disabled until required fields are filled
  });

  it('shows "Save" button in edit mode', () => {
    renderModal();
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toBeDisabled(); // Initially disabled until fields are validated
  });

  it('shows basic information section', () => {
    renderModal();
    expect(screen.getByText('Basic information')).toBeInTheDocument();
  });

  it('shows name label with required indicator', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    const nameContainer = within(dialog).getByText('Name').closest('.control-label');
    expect(nameContainer).toBeInTheDocument();
    const requiredIndicator = within(nameContainer as HTMLElement).getByText('*');
    expect(requiredIndicator).toHaveClass('required');
  });
});