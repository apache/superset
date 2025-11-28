/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
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
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  HEADER_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';

import { mockStoreWithTabs } from 'spec/fixtures/mockStore';
import Header from './Header';

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('Header', () => {
  interface HeaderTestProps {
    id: string;
    dashboardId: string;
    parentId: string;
    component: any;
    depth: number;
    parentComponent: any;
    index: number;
    editMode: boolean;
    embeddedMode: boolean;
    filters: Record<string, any>;
    handleComponentDrop: () => void;
    deleteComponent: sinon.SinonSpy;
    updateComponents: sinon.SinonSpy;
  }

  const baseComponent = newComponentFactory(HEADER_TYPE);
  const props: HeaderTestProps = {
    id: 'id',
    dashboardId: '1',
    parentId: 'parentId',
    component: {
      ...baseComponent,
      id: 'id',
      meta: {
        ...(baseComponent.meta || {}),
        text: 'New Title',
      },
    },
    depth: 1,
    parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
    index: 0,
    editMode: false,
    embeddedMode: false,
    filters: {},
    handleComponentDrop: () => {},
    deleteComponent: sinon.spy(),
    updateComponents: sinon.spy(),
  };

  function setup(overrideProps: Partial<HeaderTestProps> = {}) {
    return render(
      <Provider store={mockStoreWithTabs}>
        <DndProvider backend={HTML5Backend}>
          <Header {...(props as HeaderTestProps)} {...overrideProps} />
        </DndProvider>
      </Provider>,
    );
  }

  beforeEach(() => {
    if (props.deleteComponent) props.deleteComponent.resetHistory();
    if (props.updateComponents) props.updateComponents.resetHistory();
  });

  test('should render a Draggable', () => {
    setup();
    expect(screen.getByTestId('dragdroppable-object')).toBeInTheDocument();
  });

  test('should render a WithPopoverMenu', () => {
    setup();
    expect(screen.getByRole('none')).toBeInTheDocument();
  });

  test('should render a HoverMenu in editMode', () => {
    setup();
    expect(screen.queryByTestId('hover-menu')).not.toBeInTheDocument();

    setup({ editMode: true });
    const hoverMenus = screen.getAllByTestId('hover-menu');
    expect(hoverMenus[0]).toBeInTheDocument();
  });

  test('should render an EditableTitle with meta.text', () => {
    setup();
    const titleElement = screen.getByTestId('editable-title');
    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveTextContent(props.component.meta.text);
  });

  test('should call updateComponents when EditableTitle changes', () => {
    const updateComponents = sinon.spy();
    setup({ editMode: true, updateComponents });

    // First click to enter edit mode
    const titleButton = screen.getByTestId('textarea-editable-title-input');
    fireEvent.click(titleButton);

    // Then change the input value and blur to trigger save
    const titleInput = screen.getByTestId('textarea-editable-title-input');
    fireEvent.change(titleInput, { target: { value: 'New title' } });
    fireEvent.blur(titleInput);

    const headerId = props.id;
    expect(updateComponents.callCount).toBe(1);
    const componentUpdates = updateComponents.getCall(0).args[0] as Record<
      string,
      any
    >;
    expect(componentUpdates[headerId].meta.text).toBe('New title');
  });

  test('should render a DeleteComponentButton when focused in editMode', () => {
    setup({ editMode: true });
    const trashButton = screen.getByRole('img', { name: 'delete' });
    expect(trashButton).toBeInTheDocument();
  });

  test('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    setup({ editMode: true, deleteComponent });

    const trashButton = screen.getByRole('button', { name: 'delete' });
    fireEvent.click(trashButton);

    expect(deleteComponent.callCount).toBe(1);
  });

  test('should render the AnchorLink in view mode', () => {
    setup();
    expect(screen.getByTestId('anchor-link')).toBeInTheDocument();
  });

  test('should not render the AnchorLink in edit mode', () => {
    setup({ editMode: true });
    expect(screen.queryByTestId('anchor-link')).not.toBeInTheDocument();
  });

  test('should not render the AnchorLink in embedded mode', () => {
    setup({ embeddedMode: true });
    expect(screen.queryByTestId('anchor-link')).not.toBeInTheDocument();
  });
});
