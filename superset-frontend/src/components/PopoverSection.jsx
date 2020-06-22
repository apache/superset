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
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';

const propTypes = {
  title: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
  info: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default function PopoverSection({
  title,
  isSelected,
  children,
  onSelect,
  info,
}) {
  return (
    <div className={'PopoverSection ' + (!isSelected ? 'dimmed' : '')}>
      <div onClick={onSelect} className="pointer">
        <strong>{title}</strong> &nbsp;
        {info && (
          <InfoTooltipWithTrigger tooltip={info} label="date-free-tooltip" />
        )}
        &nbsp;
        <i className={isSelected ? 'fa fa-check text-primary' : ''} />
      </div>
      <div className="m-t-5 m-l-5">{children}</div>
    </div>
  );
}
PopoverSection.propTypes = propTypes;
