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
import React, { useCallback } from 'react';
import { IconTooltip, List } from '@superset-ui/core/components';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core';
import { useTheme, type SupersetTheme } from '@apache-superset/core/ui';
import {
  SortableContainer,
  SortableHandle,
  SortableElement,
  arrayMove,
} from 'react-sortable-hoc';
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

const SortableListItem = SortableElement(CustomListItem);
const SortableList = SortableContainer(List);
const SortableDragger = SortableHandle(() => (
  <Icons.MenuOutlined
    role="img"
    aria-label={t('Drag to reorder')}
    className="text-primary"
    style={{ cursor: 'ns-resize' }}
  />
));

const defaultItemGenerator = () => ({ key: nanoid(11) });
const defaultKeyAccessor = (o: CollectionItem) => o.key ?? '';

export default function CollectionControl({
  name,
  label = null,
  description = null,
  placeholder = t('Empty collection'),
  addTooltip = t('Add an item'),
  itemGenerator = defaultItemGenerator,
  keyAccessor = defaultKeyAccessor,
  onChange = () => {},
  value = [],
  isFloat,
  isInt,
  controlName,
  ...headerProps
}: CollectionControlProps & { [key: string]: unknown }) {
  const theme = useTheme();

  const handleChange = useCallback(
    (i: number, itemValue: CollectionItem) => {
      const newValue = [...value];
      newValue[i] = { ...value[i], ...itemValue };
      onChange(newValue);
    },
    [value, onChange],
  );

  const handleAdd = useCallback(() => {
    const newItem = itemGenerator();
    // Cast needed: original JS allowed undefined items from itemGenerator
    onChange(value.concat([newItem] as unknown as CollectionItem[]));
  }, [value, onChange, itemGenerator]);

  const handleSortEnd = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      onChange(arrayMove(value, oldIndex, newIndex));
    },
    [value, onChange],
  );

  const removeItem = useCallback(
    (i: number) => {
      onChange(value.filter((o, ix) => i !== ix));
    },
    [value, onChange],
  );

  const renderList = () => {
    if (value.length === 0) {
      return <div className="text-muted">{placeholder}</div>;
    }
    const Control = (controlMap as Record<string, React.ComponentType<any>>)[
      controlName
    ];
    return (
      <SortableList
        useDragHandle
        lockAxis="y"
        onSortEnd={handleSortEnd}
        bordered
        css={(themeArg: SupersetTheme) => ({
          borderRadius: themeArg.borderRadius,
        })}
      >
        {value.map((o: CollectionItem, i: number) => (
          <SortableListItem
            selectable={false}
            className="clearfix"
            css={(themeArg: SupersetTheme) => ({
              alignItems: 'center',
              justifyContent: 'flex-start',
              display: 'flex',
              paddingInline: themeArg.sizeUnit * 6,
            })}
            key={keyAccessor(o)}
            index={i}
          >
            <SortableDragger />
            <div
              css={(themeArg: SupersetTheme) => ({
                flex: 1,
                marginLeft: themeArg.sizeUnit * 2,
                marginRight: themeArg.sizeUnit * 2,
              })}
            >
              <Control
                name={name}
                description={description}
                placeholder={placeholder}
                addTooltip={addTooltip}
                itemGenerator={itemGenerator}
                keyAccessor={keyAccessor}
                value={value}
                isFloat={isFloat}
                isInt={isInt}
                controlName={controlName}
                {...o}
                onChange={(itemValue: CollectionItem) =>
                  handleChange(i, itemValue)
                }
              />
            </div>
            <IconTooltip
              className="pointer"
              placement="right"
              onClick={() => removeItem(i)}
              tooltip={t('Remove item')}
              mouseEnterDelay={0}
              mouseLeaveDelay={0}
              css={(themeArg: SupersetTheme) => ({
                padding: 0,
                minWidth: 'auto',
                height: 'auto',
                lineHeight: 1,
                cursor: 'pointer',
                '& svg path': {
                  fill: themeArg.colorIcon,
                  transition: `fill ${themeArg.motionDurationMid} ease-out`,
                },
                '&:hover svg path': {
                  fill: themeArg.colorError,
                },
              })}
            >
              <Icons.CloseOutlined iconSize="s" />
            </IconTooltip>
          </SortableListItem>
        ))}
      </SortableList>
    );
  };

  // Props for ControlHeader, including any header-related props passed from the parent
  const controlHeaderProps = {
    name,
    label,
    description,
    ...headerProps,
  };

  return (
    <div data-test="CollectionControl" className="CollectionControl">
      <HeaderContainer>
        <ControlHeader {...controlHeaderProps} />
        <AddIconButton onClick={handleAdd}>
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
