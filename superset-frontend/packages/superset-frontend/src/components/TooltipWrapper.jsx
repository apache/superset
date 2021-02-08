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
import { Tooltip } from 'src/common/components/Tooltip';

const propTypes = {
  label: PropTypes.string.isRequired,
  tooltip: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
  placement: PropTypes.string,
  trigger: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]),
};

const defaultProps = {
  placement: 'top',
};

export default function TooltipWrapper({
  label,
  tooltip,
  children,
  placement,
  trigger,
}) {
  return (
    <Tooltip
      id={`${kebabCase(label)}-tooltip`}
      placement={placement}
      title={tooltip}
      trigger={trigger}
    >
      {children}
    </Tooltip>
  );
}

TooltipWrapper.propTypes = propTypes;
TooltipWrapper.defaultProps = defaultProps;
