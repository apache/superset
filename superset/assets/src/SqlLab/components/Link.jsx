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
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  href: PropTypes.string,
  onClick: PropTypes.func,
  placement: PropTypes.string,
  style: PropTypes.object,
  tooltip: PropTypes.string,
};
const defaultProps = {
  className: '',
  href: '#',
  onClick: () => {},
  placement: 'top',
  style: {},
  tooltip: null,
};

class Link extends React.PureComponent {
  render() {
    const tooltip = <Tooltip id="tooltip">{this.props.tooltip}</Tooltip>;
    const link = (
      <a
        href={this.props.href}
        onClick={this.props.onClick}
        style={this.props.style}
        className={'Link ' + this.props.className}
      >
        {this.props.children}
      </a>
    );
    if (this.props.tooltip) {
      return (
        <OverlayTrigger
          overlay={tooltip}
          placement={this.props.placement}
          delayShow={300}
          delayHide={150}
        >
          {link}
        </OverlayTrigger>
      );
    }
    return link;
  }
}
Link.propTypes = propTypes;
Link.defaultProps = defaultProps;

export default Link;
