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
import { Label } from 'react-bootstrap';
import TooltipWrapper from './TooltipWrapper';

const propTypes = {
  onClick: PropTypes.func,
  className: PropTypes.string,
  tooltipContent: PropTypes.string.isRequired,
};

class RefreshLabel extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      hovered: false,
    };
  }

  mouseOver() {
    this.setState({ hovered: true });
  }

  mouseOut() {
    this.setState({ hovered: false });
  }

  render() {
    const labelStyle = this.state.hovered ? 'primary' : 'default';
    const tooltip = 'Click to ' + this.props.tooltipContent;
    return (
      <TooltipWrapper
        tooltip={tooltip}
        label="cache-desc"
      >
        <Label
          className={this.props.className}
          bsStyle={labelStyle}
          style={{ fontSize: '13px', marginRight: '5px', cursor: 'pointer' }}
          onClick={this.props.onClick}
          onMouseOver={this.mouseOver.bind(this)}
          onMouseOut={this.mouseOut.bind(this)}
        >
          <i className="fa fa-refresh" />
        </Label>
      </TooltipWrapper>);
  }
}
RefreshLabel.propTypes = propTypes;

export default RefreshLabel;
