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
import { kebabCase } from 'lodash';
import {
  Button as BootstrapButton,
  Tooltip,
  OverlayTrigger,
} from 'react-bootstrap';

const propTypes = {
  children: PropTypes.node,
  tooltip: PropTypes.node,
  placement: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  bsSize: PropTypes.string,
  btnStyles: PropTypes.string,
};
const defaultProps = {
  bsSize: 'sm',
  placement: 'top',
};

const BUTTON_WRAPPER_STYLE = { display: 'inline-block', cursor: 'not-allowed' };

export default function Button(props) {
  const buttonProps = Object.assign({}, props);
  const tooltip = props.tooltip;
  const placement = props.placement;
  delete buttonProps.tooltip;
  delete buttonProps.placement;

  let button = (
    <BootstrapButton {...buttonProps}>{props.children}</BootstrapButton>
  );
  if (tooltip) {
    if (props.disabled) {
      // Working around the fact that tooltips don't get triggered when buttons are disabled
      // https://github.com/react-bootstrap/react-bootstrap/issues/1588
      buttonProps.style = { pointerEvents: 'none' };
      button = (
        <div style={BUTTON_WRAPPER_STYLE}>
          <BootstrapButton {...buttonProps}>{props.children}</BootstrapButton>
        </div>
      );
    }
    return (
      <OverlayTrigger
        placement={placement}
        overlay={
          <Tooltip id={`${kebabCase(tooltip)}-tooltip`}>{tooltip}</Tooltip>
        }
      >
        {button}
      </OverlayTrigger>
    );
  }
  return button;
}

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;
