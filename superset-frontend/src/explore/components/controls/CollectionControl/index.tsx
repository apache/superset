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
import { Component } from 'react';
import PropTypes from 'prop-types';
import { InfoTooltip, List } from '@superset-ui/core/components';
import { nanoid } from 'nanoid';
import { t, withTheme } from '@superset-ui/core';
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

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  placeholder: PropTypes.string,
  addTooltip: PropTypes.string,
  itemGenerator: PropTypes.func,
  keyAccessor: PropTypes.func,
  onChange: PropTypes.func,
  value: PropTypes.oneOfType([PropTypes.array]),
  isFloat: PropTypes.bool,
  isInt: PropTypes.bool,
  controlName: PropTypes.string.isRequired,
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  placeholder: t('Empty collection'),
  itemGenerator: () => ({ key: nanoid(11) }),
  keyAccessor: (o: $TSFixMe) => o.key,
  value: [],
  addTooltip: t('Add an item'),
};
const SortableListItem = SortableElement(CustomListItem);
const SortableList = SortableContainer(List);
const SortableDragger = SortableHandle(() => (
  <Icons.MenuOutlined
    role="img"
    aria-label="drag"
    className="text-primary"
    style={{ cursor: 'ns-resize' }}
  />
));

class CollectionControl extends Component {
  constructor(props: $TSFixMe) {
    super(props);
    this.onAdd = this.onAdd.bind(this);
  }

  onChange(i: $TSFixMe, value: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const newValue = [...this.props.value];
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    newValue[i] = { ...this.props.value[i], ...value };
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(newValue);
  }

  onAdd() {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(this.props.value.concat([this.props.itemGenerator()]));
  }

  onSortEnd({ oldIndex, newIndex }: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(arrayMove(this.props.value, oldIndex, newIndex));
  }

  removeItem(i: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(
      // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
      this.props.value.filter((o: $TSFixMe, ix: $TSFixMe) => i !== ix),
    );
  }

  renderList() {
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    if (this.props.value.length === 0) {
      // @ts-expect-error TS(2339): Property 'placeholder' does not exist on type 'Rea... Remove this comment to see the full error message
      return <div className="text-muted">{this.props.placeholder}</div>;
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const Control = controlMap[this.props.controlName];
    return (
      <SortableList
        useDragHandle
        lockAxis="y"
        onSortEnd={this.onSortEnd.bind(this)}
        bordered
        css={theme => ({
          borderRadius: theme.borderRadius,
        })}
      >
        // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
        {this.props.value.map((o: $TSFixMe, i: $TSFixMe) => {
          // label relevant only for header, not here
          // @ts-expect-error TS(2339): Property 'label' does not exist on type 'Readonly<... Remove this comment to see the full error message
          const { label, ...commonProps } = this.props;
          return (
            // @ts-expect-error TS(2741): Property 'selectable' is missing in type '{ childr... Remove this comment to see the full error message
            <SortableListItem
              className="clearfix"
              css={theme => ({
                justifyContent: 'flex-start',
                display: '-webkit-flex',
                paddingInline: theme.sizeUnit * 3,
              })}
              // @ts-expect-error TS(2339): Property 'keyAccessor' does not exist on type 'Rea... Remove this comment to see the full error message
              key={this.props.keyAccessor(o)}
              index={i}
            >
              <SortableDragger />
              <div
                css={theme => ({
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
              <InfoTooltip
                // @ts-expect-error TS(2322): Type '{ icon: string; role: string; label: string;... Remove this comment to see the full error message
                icon="times"
                role="button"
                label="remove-item"
                tooltip={t('Remove item')}
                bsStyle="primary"
                onClick={this.removeItem.bind(this, i)}
              />
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
            <Icons.PlusOutlined iconSize="s" />
          </AddIconButton>
        </HeaderContainer>
        {this.renderList()}
      </div>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
CollectionControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
CollectionControl.defaultProps = defaultProps;

export default withTheme(CollectionControl);
