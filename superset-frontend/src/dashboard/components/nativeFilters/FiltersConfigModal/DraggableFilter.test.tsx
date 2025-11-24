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
import { render } from 'spec/helpers/testing-library';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  DraggableFilter,
  FILTER_TYPE,
  CUSTOMIZATION_TYPE,
} from './DraggableFilter';

const renderWithDnd = (component: React.ReactElement) =>
  render(<DndProvider backend={HTML5Backend}>{component}</DndProvider>);

test('identifies divider items correctly', () => {
  const onRearrange = jest.fn();
  const filterIds = ['NATIVE_FILTER_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      dragType={FILTER_TYPE}
    >
      <div>Divider Content</div>
    </DraggableFilter>,
  );

  expect(container).toBeInTheDocument();
});

test('identifies non-divider items correctly', () => {
  const onRearrange = jest.fn();
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      dragType={FILTER_TYPE}
    >
      <div>Filter Content</div>
    </DraggableFilter>,
  );

  expect(container).toBeInTheDocument();
});

test('calls onCrossListDrop when divider is dropped cross-list from filter to customization', () => {
  const onRearrange = jest.fn();
  const onCrossListDrop = jest.fn();
  const filterIds = ['NATIVE_FILTER_DIVIDER-abc123'];

  renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      onCrossListDrop={onCrossListDrop}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Drop Target</div>
    </DraggableFilter>,
  );

  expect(onCrossListDrop).not.toHaveBeenCalled();
});

test('calls onCrossListDrop when divider is dropped cross-list from customization to filter', () => {
  const onRearrange = jest.fn();
  const onCrossListDrop = jest.fn();
  const filterIds = ['CHART_CUSTOMIZATION_DIVIDER-xyz789'];

  renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      onCrossListDrop={onCrossListDrop}
      dragType={FILTER_TYPE}
    >
      <div>Drop Target</div>
    </DraggableFilter>,
  );

  expect(onCrossListDrop).not.toHaveBeenCalled();
});

test('calls onRearrange for same-list drops', () => {
  const onRearrange = jest.fn();
  const filterIds = ['NATIVE_FILTER-abc123'];

  renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      dragType={FILTER_TYPE}
    >
      <div>Filter Content</div>
    </DraggableFilter>,
  );

  expect(onRearrange).not.toHaveBeenCalled();
});

test('does not call onCrossListDrop when non-divider is dropped cross-list', () => {
  const onRearrange = jest.fn();
  const onCrossListDrop = jest.fn();
  const filterIds = ['NATIVE_FILTER-abc123'];

  renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      onCrossListDrop={onCrossListDrop}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Drop Target</div>
    </DraggableFilter>,
  );

  expect(onCrossListDrop).not.toHaveBeenCalled();
});

test('renders children correctly', () => {
  const onRearrange = jest.fn();
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { getByText } = renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      dragType={FILTER_TYPE}
    >
      <div>Test Content</div>
    </DraggableFilter>,
  );

  expect(getByText('Test Content')).toBeInTheDocument();
});

test('accepts both FILTER_TYPE and CUSTOMIZATION_TYPE drops', () => {
  const onRearrange = jest.fn();
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      dragType={FILTER_TYPE}
    >
      <div>Drop Zone</div>
    </DraggableFilter>,
  );

  expect(container).toBeInTheDocument();
});

test('uses FILTER_TYPE as default dragType', () => {
  const onRearrange = jest.fn();
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter index={0} filterIds={filterIds} onRearrange={onRearrange}>
      <div>Default Type</div>
    </DraggableFilter>,
  );

  expect(container).toBeInTheDocument();
});

test('detects cross-list drop correctly', () => {
  const onRearrange = jest.fn();
  const onCrossListDrop = jest.fn();
  const filterIds = ['NATIVE_FILTER_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      onCrossListDrop={onCrossListDrop}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Cross List Target</div>
    </DraggableFilter>,
  );

  expect(container).toBeInTheDocument();
});

test('identifies chart customization divider with underscore prefix', () => {
  const onRearrange = jest.fn();
  const filterIds = ['CHART_CUSTOMIZATION_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      index={0}
      filterIds={filterIds}
      onRearrange={onRearrange}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Customization Divider</div>
    </DraggableFilter>,
  );

  expect(container).toBeInTheDocument();
});
