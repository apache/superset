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
import { FormControl } from 'react-bootstrap';
import { Tooltip } from 'src/common/components/Tooltip';

const propTypes = {
  title: PropTypes.shape({
    label: PropTypes.string,
    hasCustomLabel: PropTypes.bool,
  }),
  onChange: PropTypes.func.isRequired,
};

export default class AdhocMetricEditPopoverTitle extends React.Component {
  constructor(props) {
    super(props);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onMouseOut = this.onMouseOut.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onInputBlur = this.onInputBlur.bind(this);
    this.state = {
      isHovered: false,
      isEditable: false,
    };
  }

  onMouseOver() {
    this.setState({ isHovered: true });
  }

  onMouseOut() {
    this.setState({ isHovered: false });
  }

  onClick() {
    this.setState({ isEditable: true });
  }

  onBlur() {
    this.setState({ isEditable: false });
  }

  onInputBlur(e) {
    if (e.target.value === '') {
      this.props.onChange(e);
    }
    this.onBlur();
  }

  render() {
    const { title, onChange } = this.props;

    return this.state.isEditable ? (
      <FormControl
        className="metric-edit-popover-label-input"
        type="text"
        placeholder={title.label}
        value={title.hasCustomLabel ? title.label : ''}
        autoFocus
        onChange={onChange}
        onBlur={this.onInputBlur}
        data-test="AdhocMetricEditTitle#input"
      />
    ) : (
      <Tooltip placement="top" title="Click to edit label">
        <span
          className="AdhocMetricEditPopoverTitle inline-editable"
          data-test="AdhocMetricEditTitle#trigger"
          onMouseOver={this.onMouseOver}
          onMouseOut={this.onMouseOut}
          onClick={this.onClick}
          onBlur={this.onBlur}
          role="button"
          tabIndex={0}
        >
          {title.hasCustomLabel ? title.label : 'My Metric'}
          &nbsp;
          <i
            className="fa fa-pencil"
            style={{ color: this.state.isHovered ? 'black' : 'grey' }}
          />
        </span>
      </Tooltip>
    );
  }
}
AdhocMetricEditPopoverTitle.propTypes = propTypes;
