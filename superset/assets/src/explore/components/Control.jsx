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

import './Control.css';
import controlMap from './controls';

const controlTypes = Object.keys(controlMap);

const propTypes = {
  actions: PropTypes.object.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.oneOf(controlTypes).isRequired,
  hidden: PropTypes.bool,
  label: PropTypes.string.isRequired,
  choices: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.array),
    PropTypes.func,
  ]),
  description: PropTypes.string,
  tooltipOnClick: PropTypes.func,
  places: PropTypes.number,
  validationErrors: PropTypes.array,
  renderTrigger: PropTypes.bool,
  rightNode: PropTypes.node,
  formData: PropTypes.object,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.object,
    PropTypes.bool,
    PropTypes.array,
    PropTypes.func,
  ]),
};

const defaultProps = {
  renderTrigger: false,
  hidden: false,
  validationErrors: [],
};

export default class Control extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { hovered: false };
    this.onChange = this.onChange.bind(this);
  }
  onChange(value, errors) {
    this.props.actions.setControlValue(this.props.name, value, errors);
  }
  setHover(hovered) {
    this.setState({ hovered });
  }
  render() {
    const ControlType = controlMap[this.props.type];
    const divStyle = this.props.hidden ? { display: 'none' } : null;
    return (
      <div
        className="Control"
        data-test={this.props.name}
        style={divStyle}
        onMouseEnter={this.setHover.bind(this, true)}
        onMouseLeave={this.setHover.bind(this, false)}
      >
        <ControlType
          onChange={this.onChange}
          hovered={this.state.hovered}
          {...this.props}
        />
      </div>
    );
  }
}

Control.propTypes = propTypes;
Control.defaultProps = defaultProps;
