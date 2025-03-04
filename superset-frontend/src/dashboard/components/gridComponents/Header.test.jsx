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
import { Provider } from 'react-redux';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import sinon from 'sinon';

import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import Header from 'src/dashboard/components/gridComponents/Header';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  HEADER_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';

import { mockStoreWithTabs } from 'spec/fixtures/mockStore';

describe('Header', () => {
  const props = {
    id: 'id',
    parentId: 'parentId',
    component: newComponentFactory(HEADER_TYPE),
    depth: 1,
    parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
    index: 0,
    editMode: false,
    embeddedMode: false,
    filters: {},
    handleComponentDrop() {},
    deleteComponent() {},
    updateComponents() {},
  };

  function setup(overrideProps) {
    return render(
      <Provider store={mockStoreWithTabs}>
        <DndProvider backend={HTML5Backend}>
          <Header {...props} {...overrideProps} />
        </DndProvider>
      </Provider>,
    );
  }

  it('should render a Draggable', () => {
    setup();
    expect(screen.getByTestId('dragdroppable-object')).toBeInTheDocument();
  });

  it('should render a WithPopoverMenu', () => {
    setup();
    expect(screen.getByRole('none')).toBeInTheDocument();
  });

  it('should render a HoverMenu in editMode', () => {
    setup();
    expect(screen.queryByTestId('hover-menu')).not.toBeInTheDocument();

    setup({ editMode: true });
    const hoverMenus = screen.getAllByTestId('hover-menu');
    expect(hoverMenus[0]).toBeInTheDocument();
  });

  it('should render an EditableTitle with meta.text', () => {
    setup();
    const titleElement = screen.getByTestId('editable-title-input');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent(props.component.meta.text);
  });

  it('should call updateComponents when EditableTitle changes', () => {
    const updateComponents = sinon.spy();
    setup({ editMode: true, updateComponents });

    // First click to enter edit mode
    const titleButton = screen.getByTestId('editable-title-input');
    fireEvent.click(titleButton);

    // Then change the input value and blur to trigger save
    const titleInput = screen.getByTestId('editable-title-input');
    fireEvent.change(titleInput, { target: { value: 'New title' } });
    fireEvent.blur(titleInput);

    const headerId = props.component.id;
    expect(updateComponents.callCount).toBe(1);
    expect(updateComponents.getCall(0).args[0][headerId].meta.text).toBe(
      'New title',
    );
  });

  it('should render a DeleteComponentButton when focused in editMode', () => {
    setup({ editMode: true });
    const trashButton = screen.getByRole('img', { name: 'trash' });
    expect(trashButton).toBeInTheDocument();
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    setup({ editMode: true, deleteComponent });

    const trashButton = screen.getByRole('img', { name: 'trash' });
    fireEvent.click(trashButton.parentElement);

    expect(deleteComponent.callCount).toBe(1);
  });

  it('should render the AnchorLink in view mode', () => {
    setup();
    expect(screen.getByTestId('anchor-link')).toBeInTheDocument();
  });

  it('should not render the AnchorLink in edit mode', () => {
    setup({ editMode: true });
    expect(screen.queryByTestId('anchor-link')).not.toBeInTheDocument();
  });

  it('should not render the AnchorLink in embedded mode', () => {
    setup({ embeddedMode: true });
    expect(screen.queryByTestId('anchor-link')).not.toBeInTheDocument();
  });
});
