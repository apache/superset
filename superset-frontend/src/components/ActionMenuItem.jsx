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
import { MenuItem } from 'react-bootstrap';

import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

export function MenuItemContent({ faIcon, text, tooltip, children }) {
  return (
    <span>
      {faIcon && <i className={`fa fa-${faIcon}`}>&nbsp;</i>}
      {text} {''}
      <InfoTooltipWithTrigger
        tooltip={tooltip}
        label={faIcon ? `dash-${faIcon}` : ''}
        placement="top"
      />
      {children}
    </span>
  );
}

MenuItemContent.propTypes = {
  faIcon: PropTypes.string,
  text: PropTypes.string,
  tooltip: PropTypes.string,
  children: PropTypes.node,
};

MenuItemContent.defaultProps = {
  faIcon: '',
  text: '',
  tooltip: null,
  children: null,
};

export function ActionMenuItem({
  onClick,
  href,
  target,
  text,
  tooltip,
  children,
  faIcon,
}) {
  return (
    <MenuItem onClick={onClick} href={href} target={target}>
      <MenuItemContent faIcon={faIcon} text={text} tooltip={tooltip}>
        {children}
      </MenuItemContent>
    </MenuItem>
  );
}

ActionMenuItem.propTypes = {
  onClick: PropTypes.func,
  href: PropTypes.string,
  target: PropTypes.string,
  ...MenuItemContent.propTypes,
};

ActionMenuItem.defaultProps = {
  onClick() {},
  href: null,
  target: null,
};
