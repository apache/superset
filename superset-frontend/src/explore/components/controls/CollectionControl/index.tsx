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
import React, { Component } from 'react';
import { IconTooltip, List } from '@superset-ui/core/components';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core';
import { withTheme, type SupersetTheme } from '@apache-superset/core/ui';
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
  theme: SupersetTheme;
}

const defaultProps: Partial<CollectionControlProps> = {
  label: null,
  description: null,
  onChange: () => {},
  placeholder: t('Empty collection'),
  itemGenerator: () => ({ key: nanoid(11) }),
  keyAccessor: (o: CollectionItem) => o.key ?? '',
  value: [],
  addTooltip: t('Add an item'),
};
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

class CollectionControl extends Component<CollectionControlProps> {
  static defaultProps = defaultProps;

  constructor(props: CollectionControlProps) {
    super(props);
    this.onAdd = this.onAdd.bind(this);
  }

  onChange(i: number, value: CollectionItem) {
    const currentValue = this.props.value ?? [];
    const newValue = [...currentValue];
    newValue[i] = { ...currentValue[i], ...value };
    this.props.onChange?.(newValue);
  }

  onAdd() {
    const currentValue = this.props.value ?? [];
    const newItem = this.props.itemGenerator?.();
    // Cast needed: original JS allowed undefined items from itemGenerator
    this.props.onChange?.(
      currentValue.concat([newItem] as unknown as CollectionItem[]),
    );
  }

  onSortEnd({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) {
    const currentValue = this.props.value ?? [];
    this.props.onChange?.(arrayMove(currentValue, oldIndex, newIndex));
  }

  removeItem(i: number) {
    const currentValue = this.props.value ?? [];
    this.props.onChange?.(currentValue.filter((o, ix) => i !== ix));
  }

  renderList() {
    const currentValue = this.props.value ?? [];
    if (currentValue.length === 0) {
      return <div className="text-muted">{this.props.placeholder}</div>;
    }
    const Control = (controlMap as Record<string, React.ComponentType<any>>)[
      this.props.controlName
    ];
    const keyAccessor =
      this.props.keyAccessor ?? ((o: CollectionItem) => o.key ?? '');
    return (
      <SortableList
        useDragHandle
        lockAxis="y"
        onSortEnd={this.onSortEnd.bind(this)}
        bordered
        css={(theme: SupersetTheme) => ({
          borderRadius: theme.borderRadius,
        })}
      >
        {currentValue.map((o: CollectionItem, i: number) => {
          // label relevant only for header, not here
          const { label, theme, ...commonProps } = this.props;
          return (
            <SortableListItem
              selectable={false}
              className="clearfix"
              css={(theme: SupersetTheme) => ({
                alignItems: 'center',
                justifyContent: 'flex-start',
                display: 'flex',
                paddingInline: theme.sizeUnit * 6,
              })}
              key={keyAccessor(o)}
              index={i}
            >
              <SortableDragger />
              <div
                css={(theme: SupersetTheme) => ({
                  flex: 1,
                  marginLeft: theme.sizeUnit * 2,
                  marginRight: theme.sizeUnit * 2,
                })}
              >
                <Control
                  {...commonProps}
                  {...o}
                  onChange={this.onChange.bind(this, i)}
                />
              </div>
              <IconTooltip
                className="pointer"
                placement="right"
                onClick={this.removeItem.bind(this, i)}
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
            </SortableListItem>
          );
        })}
      </SortableList>
    );
  }

  render() {
    return (
      <div data-test="CollectionControl" className="CollectionControl">
        <HeaderContainer>
          <ControlHeader {...this.props} />
          <AddIconButton onClick={this.onAdd}>
            <Icons.PlusOutlined
              iconSize="s"
              iconColor={this.props.theme.colorTextLightSolid}
            />
          </AddIconButton>
        </HeaderContainer>
        {this.renderList()}
      </div>
    );
  }
}

export default withTheme(CollectionControl);
