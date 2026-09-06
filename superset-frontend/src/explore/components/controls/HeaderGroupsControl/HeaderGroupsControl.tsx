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
import { useCallback, useEffect, useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Button } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import ControlHeader from 'src/explore/components/ControlHeader';
import HeaderGroupEditor, { getGroupTitle } from './HeaderGroupEditor';
import { HeaderGroupConfig, HeaderGroupsControlProps } from './types';
import {
  collectUsedHeaderGroupColumns,
  createHeaderGroup,
  headerGroupsHaveSameColumns,
  moveHeaderGroup,
  pruneStaleHeaderGroupColumns,
  removeHeaderGroupAt,
  updateHeaderGroupAt,
} from './utils';
import {
  AddControlLabel,
  CaretContainer,
  Label,
  OptionControlContainer,
} from '../OptionControls';

const GroupsContainer = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit}px;
    border: solid 1px ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const GroupRow = styled(OptionControlContainer)`
  &,
  & > div {
    margin-bottom: ${({ theme }) => theme.sizeUnit}px;
    :last-child {
      margin-bottom: 0;
    }
  }
`;

const CloseButton = styled.button`
  ${({ theme }) => css`
    background: ${theme.colorBgLayout};
    color: ${theme.colorIcon};
    height: 100%;
    width: ${theme.sizeUnit * 6}px;
    border: none;
    border-right: solid 1px ${theme.colorBorder};
    padding: 0;
    outline: none;
    border-bottom-left-radius: 3px;
    border-top-left-radius: 3px;
  `}
`;

const DragHandleSlot = styled.span`
  display: inline-flex;
  button {
    cursor: ns-resize;
    padding-inline: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const AddGroupIcon = styled.span`
  margin: auto ${({ theme }) => theme.sizeUnit}px auto 0;
  vertical-align: baseline;
  display: inline-flex;
`;

function DragHandle() {
  return <Icons.MenuOutlined aria-hidden className="text-primary" />;
}

type SortableGroupRowProps = {
  group: HeaderGroupConfig;
  index: number;
  columnOptions: NonNullable<HeaderGroupsControlProps['columnOptions']>;
  usedColumns: Set<string>;
  onChange: (path: number[], next: HeaderGroupConfig) => void;
  onAddChild: (path: number[]) => void;
  onRemove: (path: number[]) => void;
};

function SortableGroupRow({
  group,
  index,
  columnOptions,
  usedColumns,
  onChange,
  onAddChild,
  onRemove,
}: SortableGroupRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id: group.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
      }}
    >
      <GroupRow>
        <DragHandleSlot ref={setActivatorNodeRef}>
          <Button
            buttonStyle="link"
            buttonSize="small"
            aria-label={t('Drag to reorder')}
            icon={<DragHandle />}
            {...attributes}
            {...listeners}
          />
        </DragHandleSlot>
        <CloseButton
          aria-label={t('Remove group')}
          onClick={() => onRemove([index])}
        >
          <Icons.CloseOutlined iconSize="m" />
        </CloseButton>
        <HeaderGroupEditor
          mode="edit"
          group={group}
          path={[index]}
          columnOptions={columnOptions}
          usedColumns={usedColumns}
          onChange={onChange}
          onAddChild={onAddChild}
          onRemove={onRemove}
        >
          <OptionControlContainer withCaret>
            <Label>{getGroupTitle([index])}</Label>
            <CaretContainer>
              <Icons.RightOutlined iconSize="m" />
            </CaretContainer>
          </OptionControlContainer>
        </HeaderGroupEditor>
      </GroupRow>
    </div>
  );
}

export default function HeaderGroupsControl({
  value = [],
  onChange,
  columnOptions = [],
  timeComparisonGroups: _timeComparisonGroups,
  ...props
}: HeaderGroupsControlProps) {
  const groups = value ?? [];

  useEffect(() => {
    if (!onChange || columnOptions.length === 0) {
      return;
    }
    const next = pruneStaleHeaderGroupColumns(groups, columnOptions);
    if (!headerGroupsHaveSameColumns(groups, next)) {
      onChange(next);
    }
  }, [columnOptions, groups, onChange]);

  const usedColumns = useMemo(
    () => new Set(collectUsedHeaderGroupColumns(groups, columnOptions)),
    [columnOptions, groups],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleGroupChange = (path: number[], next: HeaderGroupConfig) => {
    onChange?.(updateHeaderGroupAt(groups, path, () => next));
  };

  const handleAddGroup = (group: HeaderGroupConfig) => {
    onChange?.([...groups, group]);
  };

  const handleAddChild = (path: number[]) => {
    onChange?.(
      updateHeaderGroupAt(groups, path, group => ({
        ...group,
        children: [...(group.children ?? []), createHeaderGroup()],
      })),
    );
  };

  const handleRemove = (path: number[]) => {
    onChange?.(removeHeaderGroupAt(groups, path));
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) {
        return;
      }
      const fromIndex = groups.findIndex(group => group.id === active.id);
      const toIndex = groups.findIndex(group => group.id === over.id);
      onChange?.(moveHeaderGroup(groups, fromIndex, toIndex));
    },
    [groups, onChange],
  );

  return (
    <div data-test="header-groups-control">
      <ControlHeader {...props} />
      <GroupsContainer>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={groups.map(group => group.id)}
            strategy={verticalListSortingStrategy}
          >
            {groups.map((group, index) => (
              <SortableGroupRow
                key={group.id}
                group={group}
                index={index}
                columnOptions={columnOptions}
                usedColumns={usedColumns}
                onChange={handleGroupChange}
                onAddChild={handleAddChild}
                onRemove={handleRemove}
              />
            ))}
          </SortableContext>
        </DndContext>
        <HeaderGroupEditor
          mode="add"
          path={[groups.length]}
          columnOptions={columnOptions}
          usedColumns={usedColumns}
          onSave={handleAddGroup}
        >
          <AddControlLabel>
            <AddGroupIcon>
              <Icons.PlusOutlined iconSize="m" />
            </AddGroupIcon>
            {t('Add group')}
          </AddControlLabel>
        </HeaderGroupEditor>
      </GroupsContainer>
    </div>
  );
}
