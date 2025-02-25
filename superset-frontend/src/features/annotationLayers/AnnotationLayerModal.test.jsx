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
import fetchMock from 'fetch-mock';
import { render, screen } from 'spec/helpers/testing-library';
import AnnotationLayerModal from './AnnotationLayerModal';

const mockData = { id: 1, name: 'test', descr: 'test description' };
const FETCH_ANNOTATION_LAYER_ENDPOINT = 'glob:*/api/v1/annotation_layer/*';
const ANNOTATION_LAYER_PAYLOAD = { result: mockData };

fetchMock.get(FETCH_ANNOTATION_LAYER_ENDPOINT, ANNOTATION_LAYER_PAYLOAD);

const mockedProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  onLayerAdd: jest.fn(() => []),
  onHide: jest.fn(),
  show: true,
  layer: mockData,
};

const renderModal = (props = {}) =>
  render(<AnnotationLayerModal {...mockedProps} {...props} />, {
    useRedux: true,
  });

describe('AnnotationLayerModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.resetHistory();
  });

  it('renders the modal', async () => {
    renderModal();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('renders add header when no layer is included', async () => {
    renderModal({ layer: null });
    expect(
      await screen.findByTestId('annotation-layer-modal-title'),
    ).toHaveTextContent('Add annotation layer');
  });

  it('renders edit header when layer prop is included', async () => {
    renderModal();
    expect(
      await screen.findByTestId('annotation-layer-modal-title'),
    ).toHaveTextContent('Edit annotation layer properties');
  });

  it('renders input element for name', async () => {
    renderModal();
    const nameInput = await screen.findByRole('textbox', {
      name: /annotation layer name/i,
    });
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('name', 'name');
    expect(nameInput).toHaveValue('test');
  });

  it('renders textarea element for description', async () => {
    renderModal();
    const descriptionTextarea = await screen.findByRole('textbox', {
      name: /description/i,
    });
    expect(descriptionTextarea).toBeInTheDocument();
    expect(descriptionTextarea).toHaveAttribute('name', 'descr');
    expect(descriptionTextarea).toHaveValue('test description');
  });

  it('disables save button when name is empty', async () => {
    renderModal({ layer: { ...mockData, name: '' } });
    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when name is provided', async () => {
    renderModal();
    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeEnabled();
  });

  it('shows "Add" button in create mode', async () => {
    renderModal({ layer: null });
    const addButton = await screen.findByRole('button', { name: 'Add' });
    expect(addButton).toBeInTheDocument();
  });

  it('shows "Save" button in edit mode', async () => {
    renderModal();
    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeInTheDocument();
  });

  it('shows required indicator for name field', async () => {
    renderModal();
    const requiredIndicator = await screen.findByText('*');
    expect(requiredIndicator).toBeInTheDocument();
    expect(requiredIndicator).toHaveClass('required');
  });

  it('shows description placeholder text', async () => {
    renderModal({ layer: null });
    const descriptionTextarea = await screen.findByRole('textbox', {
      name: /description/i,
    });
    expect(descriptionTextarea).toHaveAttribute(
      'placeholder',
      'Description (this can be seen in the list)',
    );
  });
});
