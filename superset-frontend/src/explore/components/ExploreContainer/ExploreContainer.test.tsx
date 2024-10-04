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
import { useContext } from 'react';
import { fireEvent, render } from 'spec/helpers/testing-library';
import { OptionControlLabel } from 'src/explore/components/controls/OptionControls';

import ExploreContainer, { DraggingContext, DropzoneContext } from '.';
import OptionWrapper from '../controls/DndColumnSelectControl/OptionWrapper';
import DatasourcePanelDragOption from '../DatasourcePanel/DatasourcePanelDragOption';
import { DndItemType } from '../DndItemType';

const MockChildren = () => {
  const dragging = useContext(DraggingContext);
  return (
    <div data-test="mock-children" className={dragging ? 'dragging' : ''}>
      {dragging ? 'dragging' : 'not dragging'}
    </div>
  );
};

const MockChildren2 = () => {
  const [zones, dispatch] = useContext(DropzoneContext);
  return (
    <>
      <div data-test="mock-children">{Object.keys(zones).join(':')}</div>
      <button
        type="button"
        onClick={() => dispatch({ key: 'test_item_1', canDrop: () => true })}
      >
        Add
      </button>
      <button type="button" onClick={() => dispatch({ key: 'test_item_1' })}>
        Remove
      </button>
    </>
  );
};

test('should render children', () => {
  const { getByTestId, getByText } = render(
    <ExploreContainer>
      <MockChildren />
    </ExploreContainer>,
    { useRedux: true, useDnd: true },
  );
  expect(getByTestId('mock-children')).toBeInTheDocument();
  expect(getByText('not dragging')).toBeInTheDocument();
});

test('should only propagate dragging state when dragging the panel option', () => {
  const defaultProps = {
    label: <span>Test label</span>,
    tooltipTitle: 'This is a tooltip title',
    onRemove: jest.fn(),
    onMoveLabel: jest.fn(),
    onDropLabel: jest.fn(),
    type: 'test',
    index: 0,
  };
  const { container, getByText } = render(
    <ExploreContainer>
      <DatasourcePanelDragOption
        value={{ metric_name: 'panel option' }}
        type={DndItemType.Metric}
      />
      <OptionControlLabel
        {...defaultProps}
        index={1}
        label={<span>Metric item</span>}
      />
      <OptionWrapper
        {...defaultProps}
        index={2}
        label="Column item"
        clickClose={() => {}}
        onShiftOptions={() => {}}
      />
      <MockChildren />
    </ExploreContainer>,
    {
      useRedux: true,
      useDnd: true,
    },
  );
  expect(container.getElementsByClassName('dragging')).toHaveLength(0);
  fireEvent.dragStart(getByText('panel option'));
  expect(container.getElementsByClassName('dragging')).toHaveLength(1);
  fireEvent.dragEnd(getByText('panel option'));
  fireEvent.dragStart(getByText('Metric item'));
  expect(container.getElementsByClassName('dragging')).toHaveLength(0);
  fireEvent.dragEnd(getByText('Metric item'));
  expect(container.getElementsByClassName('dragging')).toHaveLength(0);
  // don't show dragging state for the sorting item
  fireEvent.dragStart(getByText('Column item'));
  expect(container.getElementsByClassName('dragging')).toHaveLength(0);
});

test('should manage the dropValidators', () => {
  const { queryByText, getByText } = render(
    <ExploreContainer>
      <MockChildren2 />
    </ExploreContainer>,
    {
      useRedux: true,
      useDnd: true,
    },
  );

  expect(queryByText('test_item_1')).not.toBeInTheDocument();
  const addDropValidatorButton = getByText('Add');
  fireEvent.click(addDropValidatorButton);
  expect(getByText('test_item_1')).toBeInTheDocument();
  const removeDropValidatorButton = getByText('Remove');
  fireEvent.click(removeDropValidatorButton);
  expect(queryByText('test_item_1')).not.toBeInTheDocument();
});
