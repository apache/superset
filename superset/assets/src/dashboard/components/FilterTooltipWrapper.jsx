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
import { Overlay, Tooltip } from 'react-bootstrap';

const propTypes = {
  tooltip: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};

class FilterTooltipWrapper extends React.Component {
  constructor(props) {
    super(props);

    // internal instance variable to make tooltip show/hide have delay
    this.isHover = false;
    this.state = {
      show: false,
    };

    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.attachRef = target => this.setState({ target });
  }

  showTooltip() {
    this.isHover = true;

    setTimeout(() => this.isHover && this.setState({ show: true }), 100);
  }

  hideTooltip() {
    this.isHover = false;

    setTimeout(() => !this.isHover && this.setState({ show: false }), 300);
  }

  render() {
    const { show, target } = this.state;
    return (
      <React.Fragment>
        <Overlay container={this} target={target} show={show} placement="left">
          <Tooltip id="filter-indicator-tooltip">
            <div onMouseOver={this.showTooltip} onMouseOut={this.hideTooltip}>
              {this.props.tooltip}
            </div>
          </Tooltip>
        </Overlay>

        <div
          className="indicator-container"
          onMouseOver={this.showTooltip}
          onMouseOut={this.hideTooltip}
          ref={this.attachRef}
        >
          {this.props.children}
        </div>
      </React.Fragment>
    );
  }
}

FilterTooltipWrapper.propTypes = propTypes;

export default FilterTooltipWrapper;
