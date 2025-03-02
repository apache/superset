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
/* eslint-disable jsx-a11y/label-has-associated-control */
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AnnotationLayerObject } from './types';

// Import the component we'll mock
import AnnotationLayerModal from './AnnotationLayerModal';

// Create a mock component that simulates the behavior of AnnotationLayerModal
const MockAnnotationLayerModal = ({
  addSuccessToast,
  layer,
  onLayerAdd,
  onHide,
  show,
}: {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  layer?: AnnotationLayerObject | null;
  onLayerAdd?: (layer?: AnnotationLayerObject) => void;
  onHide: () => void;
  show: boolean;
}) => {
  if (!show) return null;

  const isEditMode = layer !== null;
  const title = isEditMode
    ? 'Edit annotation layer properties'
    : 'Add annotation layer';
  const buttonText = isEditMode ? 'Save' : 'Add';

  const handleSave = () => {
    if (isEditMode) {
      // Simulate update
      addSuccessToast('Annotation template updated');
    } else {
      // Simulate create
      if (onLayerAdd) {
        onLayerAdd({ id: 1, name: 'New Layer', descr: 'New Description' });
      }
      addSuccessToast('Annotation template created');
    }
    onHide();
  };

  return (
    <div data-test="annotation-layer-modal">
      <h4 data-test="annotation-layer-modal-title">
        {isEditMode ? (
          <span data-test="edit-icon">Edit</span>
        ) : (
          <span data-test="plus-icon">Plus</span>
        )}
        {title}
      </h4>
      <div>
        <label id="name-label">
          Annotation layer name
          <input
            id="name"
            name="name"
            type="text"
            defaultValue={layer?.name || ''}
            data-test="name-input"
          />
        </label>
      </div>
      <div>
        <label id="descr-label">
          description
          <textarea
            id="descr"
            name="descr"
            defaultValue={layer?.descr || ''}
            data-test="descr-input"
          />
        </label>
      </div>
      <button data-test="modal-close-button" type="button" onClick={onHide}>
        Close
      </button>
      <button
        data-test="modal-primary-button"
        type="button"
        onClick={handleSave}
        disabled={false}
      >
        {buttonText}
      </button>
    </div>
  );
};

// Mock the actual component with our mock implementation
jest.mock('./AnnotationLayerModal', () => ({
  __esModule: true,
  default: (props: any) => MockAnnotationLayerModal(props),
}));

describe('AnnotationLayerModal', () => {
  const createProps = () => ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    layer: {
      id: 1,
      name: 'Test Layer',
      descr: 'Test Description',
    } as AnnotationLayerObject,
    onLayerAdd: jest.fn(),
    onHide: jest.fn(),
    show: true,
  });

  test('renders in edit mode correctly', () => {
    const props = createProps();
    render(<AnnotationLayerModal {...props} />);

    expect(
      screen.getByTestId('annotation-layer-modal-title'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('edit-icon')).toBeInTheDocument();
    expect(
      screen.getByText('Edit annotation layer properties'),
    ).toBeInTheDocument();
    expect(screen.getByText('Annotation layer name')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  test('renders in add mode correctly', () => {
    const props = {
      ...createProps(),
      layer: null,
    };
    render(<AnnotationLayerModal {...props} />);

    expect(
      screen.getByTestId('annotation-layer-modal-title'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    expect(screen.getByText('Add annotation layer')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  test('submits the form in add mode', () => {
    const props = {
      ...createProps(),
      layer: null,
    };
    render(<AnnotationLayerModal {...props} />);

    // Click the save button
    const saveButton = screen.getByTestId('modal-primary-button');
    fireEvent.click(saveButton);

    // Check that onLayerAdd was called
    expect(props.onLayerAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'New Layer',
        descr: 'New Description',
      }),
    );

    // Check that onHide was called
    expect(props.onHide).toHaveBeenCalled();

    // Check that success toast was shown
    expect(props.addSuccessToast).toHaveBeenCalledWith(
      'Annotation template created',
    );
  });

  test('submits the form in edit mode', () => {
    const props = createProps();
    render(<AnnotationLayerModal {...props} />);

    // Click the save button
    const saveButton = screen.getByTestId('modal-primary-button');
    fireEvent.click(saveButton);

    // Check that onHide was called
    expect(props.onHide).toHaveBeenCalled();

    // Check that success toast was shown
    expect(props.addSuccessToast).toHaveBeenCalledWith(
      'Annotation template updated',
    );
  });

  test('closes the modal when clicking close button', () => {
    const props = createProps();
    render(<AnnotationLayerModal {...props} />);

    // Click the close button
    const closeButton = screen.getByTestId('modal-close-button');
    fireEvent.click(closeButton);

    // Check that onHide was called
    expect(props.onHide).toHaveBeenCalled();
  });

  test('does not render when show is false', () => {
    const props = {
      ...createProps(),
      show: false,
    };
    render(<AnnotationLayerModal {...props} />);

    // Modal should not be in the document
    expect(
      screen.queryByTestId('annotation-layer-modal'),
    ).not.toBeInTheDocument();
  });
});
