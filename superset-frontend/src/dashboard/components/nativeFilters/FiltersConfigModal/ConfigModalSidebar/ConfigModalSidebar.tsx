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
import { FC, ReactNode, useCallback, useState } from 'react';
import { t } from '@apache-superset/core';
import { NativeFilterType, ChartCustomizationType } from '@superset-ui/core';
import { styled } from '@apache-superset/core/ui';
import { Collapse, Flex } from '@superset-ui/core/components';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  DndContext,
  PointerSensor,
  useSensor,
  closestCenter,
} from '@dnd-kit/core';
import NewItemDropdown from '../NewItemDropdown';
import ItemSectionContent from './ItemSection';
import { FilterRemoval } from '../types';
import { FILTER_TYPE, CUSTOMIZATION_TYPE } from '../DraggableFilter';
import { isFilterId, isChartCustomizationId } from '../utils';

const StyledSidebarFlex = styled(Flex)`
  min-width: 290px;
  max-width: 290px;
  border-right: 1px solid ${({ theme }) => theme.colorBorderSecondary};
`;

const StyledHeaderFlex = styled(Flex)`
  padding: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const BaseStyledCollapse = styled(Collapse)<{ isDragging: boolean }>`
  flex: 1;
  overflow: auto;
  .ant-collapse-content-box {
    padding: 0;
    ${({ isDragging }) =>
      isDragging &&
      `
      overflow: hidden;
    `}
  }
`;

type StyledCollapseWithPanel = typeof BaseStyledCollapse & {
  Panel: typeof Collapse.Panel;
};

const StyledCollapse = BaseStyledCollapse as StyledCollapseWithPanel;
StyledCollapse.Panel = Collapse.Panel;

export interface ConfigModalSidebarProps {
  filterIds: string[];
  chartCustomizationIds: string[];
  currentItemId: string;
  filterOrderedIds: string[];
  filterRemovedItems: Record<string, FilterRemoval>;
  filterErroredItems: string[];
  customizationOrderedIds: string[];
  customizationRemovedItems: Record<string, FilterRemoval>;
  customizationErroredItems: string[];
  activeCollapseKeys: string[];
  getItemTitle: (id: string) => string;
  onAddFilter: (type: NativeFilterType) => void;
  onAddCustomization: (type: ChartCustomizationType) => void;
  onChange: (id: string) => void;
  onRearrange: (dragIndex: number, targetIndex: number, itemId: string) => void;
  onRemove: (id: string) => void;
  restoreItem: (id: string) => void;
  onCollapseChange: (keys: string[]) => void;
  onCrossListDrop?: (
    sourceId: string,
    targetIndex: number,
    sourceType: 'filter' | 'customization',
    targetType: 'filter' | 'customization',
  ) => void;
  formValuesVersion?: number;
}

const ConfigModalSidebar: FC<ConfigModalSidebarProps> = ({
  filterIds,
  chartCustomizationIds,
  currentItemId,
  filterOrderedIds,
  filterRemovedItems,
  filterErroredItems,
  customizationOrderedIds,
  customizationRemovedItems,
  customizationErroredItems,
  activeCollapseKeys,
  getItemTitle,
  onAddFilter,
  onAddCustomization,
  onChange,
  onRearrange,
  onRemove,
  restoreItem,
  onCollapseChange,
  onCrossListDrop,
  formValuesVersion,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const sensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 10 },
  });

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeFilterIndex = filterOrderedIds.findIndex(
        id => id === active.id,
      );
      const activeCustomizationIndex = customizationOrderedIds.findIndex(
        id => id === active.id,
      );
      const overFilterIndex = filterOrderedIds.findIndex(id => id === over.id);
      const overCustomizationIndex = customizationOrderedIds.findIndex(
        id => id === over.id,
      );

      const activeData = active.data.current;

      if (
        activeFilterIndex === -1 &&
        activeCustomizationIndex === -1 &&
        activeData
      ) {
        if (
          activeData.isDivider &&
          activeData.dragType &&
          onCrossListDrop &&
          (overFilterIndex !== -1 || overCustomizationIndex !== -1)
        ) {
          const sourceType: 'filter' | 'customization' =
            activeData.dragType === FILTER_TYPE ? 'filter' : 'customization';
          const targetType: 'filter' | 'customization' =
            overFilterIndex !== -1 ? 'filter' : 'customization';
          const targetIndex =
            overFilterIndex !== -1 ? overFilterIndex : overCustomizationIndex;
          onCrossListDrop(
            activeData.filterIds[0],
            targetIndex,
            sourceType,
            targetType,
          );
        }
        return;
      }

      if (activeFilterIndex !== -1 && overFilterIndex !== -1) {
        const itemId = filterOrderedIds[activeFilterIndex];
        onRearrange(activeFilterIndex, overFilterIndex, itemId);
        return;
      }

      if (activeCustomizationIndex !== -1 && overCustomizationIndex !== -1) {
        const itemId = customizationOrderedIds[activeCustomizationIndex];
        onRearrange(activeCustomizationIndex, overCustomizationIndex, itemId);
      }
    },
    [filterOrderedIds, customizationOrderedIds, onRearrange, onCrossListDrop],
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFilterCrossListDrop = (
    sourceId: string,
    targetIndex: number,
    sourceType: 'filter' | 'customization',
  ) => {
    if (onCrossListDrop) {
      onCrossListDrop(sourceId, targetIndex, sourceType, 'filter');
    }
  };

  const handleCustomizationCrossListDrop = (
    sourceId: string,
    targetIndex: number,
    sourceType: 'filter' | 'customization',
  ) => {
    if (onCrossListDrop) {
      onCrossListDrop(sourceId, targetIndex, sourceType, 'customization');
    }
  };
  const filtersHeader: ReactNode = (
    <div>
      {t('Filters')} ({filterIds.length})
    </div>
  );

  const customizationsHeader: ReactNode = (
    <div>
      {t('Chart customizations')} ({chartCustomizationIds.length})
    </div>
  );

  return (
    <DndContext
      sensors={[sensor]}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <StyledSidebarFlex vertical>
        <StyledHeaderFlex align="center">
          <NewItemDropdown
            onAddFilter={onAddFilter}
            onAddCustomization={onAddCustomization}
          />
        </StyledHeaderFlex>
        <StyledCollapse
          key={formValuesVersion}
          activeKey={activeCollapseKeys}
          onChange={keys => onCollapseChange(keys as string[])}
          ghost
          isDragging={isDragging}
        >
          <StyledCollapse.Panel key="filters" header={filtersHeader}>
            <ItemSectionContent
              currentItemId={currentItemId}
              items={filterOrderedIds}
              removedItems={filterRemovedItems}
              erroredItems={filterErroredItems}
              getItemTitle={getItemTitle}
              onChange={onChange}
              onRearrange={onRearrange}
              onRemove={onRemove}
              restoreItem={restoreItem}
              dataTestId="filter-title-container"
              deleteAltText="RemoveFilter"
              dragType={FILTER_TYPE}
              isCurrentSection={isFilterId(currentItemId)}
              onCrossListDrop={handleFilterCrossListDrop}
            />
          </StyledCollapse.Panel>

          <StyledCollapse.Panel
            key="chartCustomizations"
            header={customizationsHeader}
          >
            <ItemSectionContent
              currentItemId={currentItemId}
              items={customizationOrderedIds}
              removedItems={customizationRemovedItems}
              erroredItems={customizationErroredItems}
              getItemTitle={getItemTitle}
              onChange={onChange}
              onRearrange={onRearrange}
              onRemove={onRemove}
              restoreItem={restoreItem}
              dataTestId="customization-title-container"
              deleteAltText="RemoveCustomization"
              dragType={CUSTOMIZATION_TYPE}
              isCurrentSection={isChartCustomizationId(currentItemId)}
              onCrossListDrop={handleCustomizationCrossListDrop}
            />
          </StyledCollapse.Panel>
        </StyledCollapse>
      </StyledSidebarFlex>
    </DndContext>
  );
};

export default ConfigModalSidebar;
