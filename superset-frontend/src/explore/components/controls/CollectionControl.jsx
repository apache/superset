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
import React from 'react';
import PropTypes from 'prop-types';
import { ListGroup, ListGroupItem } from 'react-bootstrap';
import shortid from 'shortid';
import {
  SortableContainer,
  SortableHandle,
  SortableElement,
  arrayMove,
} from 'react-sortable-hoc';

import { InfoTooltipWithTrigger } from '@superset-ui/control-utils';
import ControlHeader from '../ControlHeader';
import controlMap from './';
import './CollectionControl.less';

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
  placeholder: 'Empty collection',
  itemGenerator: () => ({ key: shortid.generate() }),
  keyAccessor: o => o.key,
  value: [],
  addTooltip: 'Add an item',
};
const SortableListGroupItem = SortableElement(ListGroupItem);
const SortableListGroup = SortableContainer(ListGroup);
const SortableDragger = SortableHandle(() => (
  <i className="fa fa-bars text-primary" style={{ cursor: 'ns-resize' }} />
));

export default class CollectionControl extends React.Component {
  constructor(props) {
    super(props);
    this.onAdd = this.onAdd.bind(this);
  }
  onChange(i, value) {
    Object.assign(this.props.value[i], value);
    this.props.onChange(this.props.value);
  }
  onAdd() {
    this.props.onChange(this.props.value.concat([this.props.itemGenerator()]));
  }
  onSortEnd({ oldIndex, newIndex }) {
    this.props.onChange(arrayMove(this.props.value, oldIndex, newIndex));
  }
  removeItem(i) {
    this.props.onChange(this.props.value.filter((o, ix) => i !== ix));
  }
  renderList() {
    if (this.props.value.length === 0) {
      return <div className="text-muted">{this.props.placeholder}</div>;
    }
    const Control = controlMap[this.props.controlName];
    return (
      <SortableListGroup
        useDragHandle
        lockAxis="y"
        onSortEnd={this.onSortEnd.bind(this)}
      >
        {this.props.value.map((o, i) => (
          <SortableListGroupItem
            className="clearfix"
            key={this.props.keyAccessor(o)}
            index={i}
          >
            <div className="pull-left m-r-5">
              <SortableDragger />
            </div>
            <div className="pull-left">
              <Control
                {...this.props}
                {...o}
                onChange={this.onChange.bind(this, i)}
              />
            </div>
            <div className="pull-right">
              <InfoTooltipWithTrigger
                icon="times"
                label="remove-item"
                tooltip="remove item"
                bsStyle="primary"
                onClick={this.removeItem.bind(this, i)}
              />
            </div>
          </SortableListGroupItem>
        ))}
      </SortableListGroup>
    );
  }
  render() {
    return (
      <div className="CollectionControl">
        <ControlHeader {...this.props} />
        {this.renderList()}
        <InfoTooltipWithTrigger
          icon="plus-circle"
          label="add-item"
          tooltip={this.props.addTooltip}
          bsStyle="primary"
          className="fa-lg"
          onClick={this.onAdd}
        />
      </div>
    );
  }
}

CollectionControl.propTypes = propTypes;
CollectionControl.defaultProps = defaultProps;
