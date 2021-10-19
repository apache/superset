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
import React, { FC, useMemo } from 'react';
import { JsonObject, styled } from '@superset-ui/core';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import cx from 'classnames';
import { buildCascadeFiltersTree } from '../nativeFilters/FilterBar/FilterControls/utils';
import {
  useFilters,
  useNativeFiltersDataMask,
} from '../nativeFilters/FilterBar/state';
import { Filter } from '../nativeFilters/types';
import { useSelectFiltersInScope } from '../nativeFilters/state';
import { CascadeFilter } from '../nativeFilters/FilterBar/CascadeFilters/types';
import DragDroppable from '../dnd/DragDroppable';
import { COLUMN_TYPE, ROW_TYPE } from '../../util/componentTypes';
import WithPopoverMenu from '../menu/WithPopoverMenu';
import ResizableContainer from '../resizable/ResizableContainer';
import {
  BACKGROUND_TRANSPARENT,
  GRID_BASE_UNIT,
  GRID_MIN_COLUMN_COUNT,
} from '../../util/constants';
import HoverMenu from '../menu/HoverMenu';
import DeleteComponentButton from '../DeleteComponentButton';
import BackgroundStyleDropdown from '../menu/BackgroundStyleDropdown';
import Icons from '../../../components/Icons';
import { theme } from '../../../preamble';

const Title = styled.div`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
`;

const FilterData = styled.div`
  white-space: nowrap;
  display: flex;
  flex-wrap: wrap;
`;

const Value = styled.div`
  white-space: nowrap;
`;

const Separator = styled.div`
  padding: 0 ${({ theme }) => theme.gridUnit * 2}px;
  &:first-child {
    display: none;
  }
`;

const Wrapper = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 4}px;
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
`;

type FilterSummaryType = {
  component: JsonObject;
  parentComponent: JsonObject;
  index: number;
  depth: number;
  handleComponentDrop: (...args: any[]) => any;
  editMode: boolean;
  columnWidth: number;
  availableColumnCount: number;
  onResizeStart: Function;
  onResizeStop: Function;
  onResize: Function;
  deleteComponent: Function;
  updateComponents: Function;
  parentId: number;
  id: number;
};

const FilterSummary: FC<FilterSummaryType> = ({
  component,
  parentComponent,
  index,
  depth,
  handleComponentDrop,
  editMode,
  columnWidth,
  availableColumnCount,
  onResizeStart,
  onResizeStop,
  onResize,
  deleteComponent,
  parentId,
  updateComponents,
  id,
}) => {
  const filters = useFilters();
  const dataMask = useNativeFiltersDataMask();
  const filterValues = Object.values<Filter>(filters);
  const cascadeFilters = buildCascadeFiltersTree(filterValues);
  const [filtersInScope] = useSelectFiltersInScope(cascadeFilters);

  const flatFilters = useMemo(() => {
    const tempFilters: CascadeFilter[] = [];
    const createFlatFilters = (filter: CascadeFilter) => {
      tempFilters.push(filter);
      filter.cascadeChildren.forEach(createFlatFilters);
    };
    filtersInScope.forEach(createFlatFilters);
    return tempFilters;
  }, [filtersInScope]);

  const getSingleUnit = ({ name, id, cascadeParentIds }: CascadeFilter) => (
    <>
      <Separator>
        {cascadeParentIds.length ? (
          <Icons.Enter iconSize="s" iconColor={theme.colors.grayscale.base} />
        ) : (
          '|'
        )}
      </Separator>
      <FilterData>
        <Title>{name}:&nbsp;</Title>
        <Value>
          {dataMask?.[id]?.filterState?.label ??
            dataMask?.[id].filterState?.value}
        </Value>
      </FilterData>
    </>
  );

  // inherit the size of parent columns
  const widthMultiple =
    parentComponent.type === COLUMN_TYPE
      ? parentComponent.meta.width || GRID_MIN_COLUMN_COUNT
      : component.meta.width || GRID_MIN_COLUMN_COUNT;

  const handleDeleteComponent = () => {
    deleteComponent(id, parentId);
  };

  const rowStyle = backgroundStyleOptions.find(
    opt => opt.value === (component.meta.background || BACKGROUND_TRANSPARENT),
  );

  const updateMeta = (metaKey: string, nextValue: string | number) => {
    updateComponents({
      [component.id]: {
        ...component,
        meta: {
          ...component.meta,
          [metaKey]: nextValue,
        },
      },
    });
  };

  return (
    <DragDroppable
      // @ts-ignore
      component={component}
      // @ts-ignore
      parentComponent={parentComponent}
      orientation={parentComponent.type === ROW_TYPE ? 'column' : 'row'}
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {({ dropIndicatorProps, dragSourceRef }) => (
        <WithPopoverMenu
          menuItems={[
            <BackgroundStyleDropdown
              id={`${component.id}-background`}
              value={component.meta.background}
              onChange={value => updateMeta('background', value)}
            />,
          ]}
          editMode={editMode}
        >
          <div
            data-test="dashboard-filter-summary"
            className={cx(
              'dashboard-component',
              'dashboard-component-filter-summary',
              rowStyle?.className,
            )}
            id={component.id}
          >
            <ResizableContainer
              id={component.id}
              adjustableWidth={parentComponent.type === ROW_TYPE}
              widthStep={columnWidth}
              widthMultiple={widthMultiple}
              heightStep={GRID_BASE_UNIT}
              adjustableHeight={false}
              heightMultiple={component.meta.height}
              minWidthMultiple={GRID_MIN_COLUMN_COUNT}
              minHeightMultiple={GRID_MIN_COLUMN_COUNT}
              maxWidthMultiple={availableColumnCount + widthMultiple}
              onResizeStart={onResizeStart}
              onResize={onResize}
              onResizeStop={onResizeStop}
            >
              <div
                ref={dragSourceRef}
                className="dashboard-component"
                data-test="dashboard-component-chart-holder"
              >
                {editMode && (
                  <HoverMenu position="top">
                    <DeleteComponentButton onDelete={handleDeleteComponent} />
                  </HoverMenu>
                )}
                <Wrapper>{flatFilters.map(getSingleUnit)}</Wrapper>
              </div>
            </ResizableContainer>
          </div>
          {dropIndicatorProps && <div {...dropIndicatorProps} />}
        </WithPopoverMenu>
      )}
    </DragDroppable>
  );
};
export default FilterSummary;
