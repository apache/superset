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
import AnnotationModal from './AnnotationModal';

const mockData = {
  id: 1,
  short_descr: 'annotation 1',
  start_dttm: '2019-07-01T10:25:00',
  end_dttm: '2019-06-11T10:25:00',
};

const FETCH_ANNOTATION_ENDPOINT =
  'glob:*/api/v1/annotation_layer/*/annotation/*';
const ANNOTATION_PAYLOAD = { result: mockData };

fetchMock.get(FETCH_ANNOTATION_ENDPOINT, ANNOTATION_PAYLOAD);

const mockedProps = {
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  annotationLayerId: 1,
  annotation: mockData,
  onAnnotationAdd: jest.fn(() => []),
  onHide: jest.fn(),
  show: true,
};

const renderModal = (props = {}) =>
  render(<AnnotationModal {...mockedProps} {...props} />, {
    useRedux: true,
  });

describe('AnnotationModal', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fetchMock.resetHistory();
  });

  it('renders the modal', async () => {
    renderModal();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('renders add header when no annotation prop is included', async () => {
    renderModal({ annotation: null });
    expect(
      await screen.findByTestId('annotation-modal-title'),
    ).toHaveTextContent('Add annotation');
  });

  it('renders edit header when annotation prop is included', async () => {
    renderModal();
    expect(
      await screen.findByTestId('annotation-modal-title'),
    ).toHaveTextContent('Edit annotation');
  });

  it('renders input elements for annotation name', async () => {
    renderModal();
    const nameInput = await screen.findByDisplayValue('annotation 1');
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('name', 'short_descr');
    expect(nameInput).toHaveAttribute('type', 'text');
  });

  it('renders date picker with start and end dates', async () => {
    renderModal();
    const startDateInput = await screen.findByPlaceholderText('Start date');
    const endDateInput = await screen.findByPlaceholderText('End date');
    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();
  });

  it('renders description textarea', async () => {
    renderModal();
    const descriptionLabel = await screen.findByText('description');
    expect(descriptionLabel).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(
      'Description (this can be seen in the list)',
    );
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute('name', 'long_descr');
  });

  it('renders json editor for json metadata', async () => {
    renderModal();
    const jsonMetadataLabel = await screen.findByText('JSON metadata');
    expect(jsonMetadataLabel).toBeInTheDocument();
  });

  it('shows required indicators', async () => {
    renderModal();
    const requiredIndicators = await screen.findAllByText('*');
    expect(requiredIndicators).toHaveLength(2); // Name and Date fields
    requiredIndicators.forEach(indicator => {
      expect(indicator).toHaveClass('required');
    });
  });

  it('shows "Add" button in create mode', async () => {
    renderModal({ annotation: null });
    const addButton = await screen.findByRole('button', { name: 'Add' });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeDisabled(); // Initially disabled until required fields are filled
  });

  it('shows "Save" button in edit mode', async () => {
    renderModal();
    const saveButton = await screen.findByRole('button', { name: 'Save' });
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).toBeEnabled(); // Enabled because all required fields are filled
  });

  it('shows description placeholder text', async () => {
    renderModal({ annotation: null });
    const textarea = await screen.findByPlaceholderText(
      'Description (this can be seen in the list)',
    );
    expect(textarea).toBeInTheDocument();
  });
});
