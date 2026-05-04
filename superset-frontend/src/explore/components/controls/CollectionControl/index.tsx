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
import React, { useCallback, useMemo } from 'react';
import { IconTooltip, List } from '@superset-ui/core/components';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core/translation';
import { useTheme, type SupersetTheme } from '@apache-superset/core/theme';
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  HeaderContainer,
  AddIconButton,
} from 'src/explore/components/controls/OptionControls';
import ControlHeader from 'src/explore/components/ControlHeader';
import CustomListItem from 'src/explore/components/controls/CustomListItem';
import controlMap from '..';

interface CollectionItem {
  key?: string;
  [key: string]: unknown;
}

interface CollectionControlProps {
  name: string;
  label?: string | null;
  description?: string | null;
  placeholder?: string;
  addTooltip?: string;
  itemGenerator?: () => CollectionItem;
  keyAccessor?: (item: CollectionItem) => string;
  onChange?: (value: CollectionItem[]) => void;
  value?: CollectionItem[];
  isFloat?: boolean;
  isInt?: boolean;
  controlName: string;
}

function DragHandle() {
  return (
    <Icons.MenuOutlined
      role="img"
      aria-label={t('Drag to reorder')}
      className="text-primary"
      style={{ cursor: 'ns-resize' }}
    />
  );
}

interface SortableItemProps {
  id: string;
  index: number;
  item: CollectionItem;
  controlProps: Omit<CollectionControlProps, 'label'>;
  onChangeItem: (index: number, value: CollectionItem) => void;
  onRemoveItem: (index: number) => void;
}

function SortableItem({
  id,
  index,
  item,
  controlProps,
  onChangeItem,
  onRemoveItem,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
  };
  const Control = (controlMap as Record<string, React.ComponentType<any>>)[
    controlProps.controlName
  ];

  return (
    <CustomListItem
      ref={setNodeRef}
      style={style}
      selectable={false}
      className="clearfix"
      css={(theme: SupersetTheme) => ({
        alignItems: 'center',
        justifyContent: 'flex-start',
        display: 'flex',
        paddingInline: theme.sizeUnit * 6,
      })}
    >
      <span {...attributes} {...listeners}>
        <DragHandle />
      </span>
      <div
        css={(theme: SupersetTheme) => ({
          flex: 1,
          marginLeft: theme.sizeUnit * 2,
          marginRight: theme.sizeUnit * 2,
        })}
      >
        <Control
          {...controlProps}
          {...item}
          onChange={(value: CollectionItem) => onChangeItem(index, value)}
        />
      </div>
      <IconTooltip
        className="pointer"
        placement="right"
        onClick={() => onRemoveItem(index)}
        tooltip={t('Remove item')}
        mouseEnterDelay={0}
        mouseLeaveDelay={0}
        css={(theme: SupersetTheme) => ({
          padding: 0,
          minWidth: 'auto',
          height: 'auto',
          lineHeight: 1,
          cursor: 'pointer',
          '& svg path': {
            fill: theme.colorIcon,
            transition: `fill ${theme.motionDurationMid} ease-out`,
          },
          '&:hover svg path': {
            fill: theme.colorError,
          },
        })}
      >
        <Icons.CloseOutlined iconSize="s" />
      </IconTooltip>
    </CustomListItem>
  );
}

const defaultKeyAccessor = (o: CollectionItem) => o.key ?? '';
const defaultItemGenerator = () => ({ key: nanoid(11) });

function CollectionControl({
  name,
  label = null,
  description = null,
  placeholder = t('Empty collection'),
  addTooltip = t('Add an item'),
  itemGenerator = defaultItemGenerator,
  keyAccessor = defaultKeyAccessor,
  onChange,
  value = [],
  isFloat,
  isInt,
  controlName,
}: CollectionControlProps) {
  const theme = useTheme();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const itemIds = useMemo(
    () => value.map((item, i) => keyAccessor(item) || String(i)),
    [value, keyAccessor],
  );

  const onAdd = useCallback(() => {
    const newItem = itemGenerator();
    onChange?.(value.concat([newItem] as unknown as CollectionItem[]));
  }, [value, itemGenerator, onChange]);

  const onChangeItem = useCallback(
    (i: number, itemValue: CollectionItem) => {
      const newValue = [...value];
      newValue[i] = { ...value[i], ...itemValue };
      onChange?.(newValue);
    },
    [value, onChange],
  );

  const onRemoveItem = useCallback(
    (i: number) => {
      onChange?.(value.filter((_, ix) => i !== ix));
    },
    [value, onChange],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = itemIds.indexOf(String(active.id));
        const newIndex = itemIds.indexOf(String(over.id));
        onChange?.(arrayMove(value, oldIndex, newIndex));
      }
    },
    [value, itemIds, onChange],
  );

  const controlProps = useMemo(
    () => ({
      name,
      description,
      placeholder,
      addTooltip,
      itemGenerator,
      keyAccessor,
      onChange,
      value,
      isFloat,
      isInt,
      controlName,
    }),
    [
      name,
      description,
      placeholder,
      addTooltip,
      itemGenerator,
      keyAccessor,
      onChange,
      value,
      isFloat,
      isInt,
      controlName,
    ],
  );

  const renderList = () => {
    if (value.length === 0) {
      return <div className="text-muted">{placeholder}</div>;
    }
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <List
            bordered
            css={(theme: SupersetTheme) => ({
              borderRadius: theme.borderRadius,
            })}
          >
            {value.map((item, i) => (
              <SortableItem
                key={itemIds[i]}
                id={itemIds[i]}
                index={i}
                item={item}
                controlProps={controlProps}
                onChangeItem={onChangeItem}
                onRemoveItem={onRemoveItem}
              />
            ))}
          </List>
        </SortableContext>
      </DndContext>
    );
  };

  return (
    <div data-test="CollectionControl" className="CollectionControl">
      <HeaderContainer>
        <ControlHeader name={name} label={label} description={description} />
        <AddIconButton onClick={onAdd}>
          <Icons.PlusOutlined
            iconSize="s"
            iconColor={theme.colorTextLightSolid}
          />
        </AddIconButton>
      </HeaderContainer>
      {renderList()}
    </div>
  );
}

export default CollectionControl;
