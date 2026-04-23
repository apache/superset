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
import {
  DndContext,
  PointerSensor,
  useSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  verticalListSortingStrategy,
  SortableContext,
} from '@dnd-kit/sortable';
import {
  DraggableFilter,
  FILTER_TYPE,
  CUSTOMIZATION_TYPE,
} from './DraggableFilter';

const DndWrapper: React.FC<{
  children: React.ReactElement;
  items: string[];
}> = ({ children, items }) => {
  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });

  return (
    <DndContext sensors={[sensor]} collisionDetection={closestCenter}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

const renderWithDnd = (component: React.ReactElement, items: string[] = []) =>
  render(<DndWrapper items={items}>{component}</DndWrapper>);

test('identifies divider items correctly', () => {
  const filterIds = ['NATIVE_FILTER_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={FILTER_TYPE}
    >
      <div>Divider Content</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('identifies non-divider items correctly', () => {
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={FILTER_TYPE}
    >
      <div>Filter Content</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('renders divider item for cross-list drop target', () => {
  const filterIds = ['NATIVE_FILTER_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Drop Target</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('renders customization divider for cross-list drop target', () => {
  const filterIds = ['CHART_CUSTOMIZATION_DIVIDER-xyz789'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={FILTER_TYPE}
    >
      <div>Drop Target</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('renders filter item for same-list drops', () => {
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={FILTER_TYPE}
    >
      <div>Filter Content</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('renders non-divider item for cross-list drop target', () => {
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Drop Target</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('renders children correctly', () => {
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { getByText } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={FILTER_TYPE}
    >
      <div>Test Content</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(getByText('Test Content')).toBeInTheDocument();
});

test('accepts both FILTER_TYPE and CUSTOMIZATION_TYPE drops', () => {
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={FILTER_TYPE}
    >
      <div>Drop Zone</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('uses FILTER_TYPE as default dragType', () => {
  const filterIds = ['NATIVE_FILTER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter id={filterIds[0]} index={0} filterIds={filterIds}>
      <div>Default Type</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('detects cross-list drop correctly', () => {
  const filterIds = ['NATIVE_FILTER_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Cross List Target</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});

test('identifies chart customization divider with underscore prefix', () => {
  const filterIds = ['CHART_CUSTOMIZATION_DIVIDER-abc123'];

  const { container } = renderWithDnd(
    <DraggableFilter
      id={filterIds[0]}
      index={0}
      filterIds={filterIds}
      dragType={CUSTOMIZATION_TYPE}
    >
      <div>Customization Divider</div>
    </DraggableFilter>,
    filterIds,
  );

  expect(container).toBeInTheDocument();
});
