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
import AdhocFilter from '../AdhocFilter';
import columnType from '../propTypes/columnType';
import adhocMetricType from '../propTypes/adhocMetricType';
import AdhocFilterPopoverTrigger from './AdhocFilterPopoverTrigger';
import { OptionControlLabel } from './OptionControls';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onFilterEdit: PropTypes.func.isRequired,
  onRemoveFilter: PropTypes.func,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      columnType,
      PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
      adhocMetricType,
    ]),
  ).isRequired,
  datasource: PropTypes.object,
  partitionColumn: PropTypes.string,
};

const AdhocFilterOption = ({
  adhocFilter,
  options,
  datasource,
  onFilterEdit,
  onRemoveFilter,
  partitionColumn,
}) => (
  <AdhocFilterPopoverTrigger
    adhocFilter={adhocFilter}
    options={options}
    datasource={datasource}
    onFilterEdit={onFilterEdit}
    partitionColumn={partitionColumn}
  >
    <OptionControlLabel
      label={adhocFilter.getDefaultLabel()}
      onRemove={onRemoveFilter}
      isAdhoc
    />
  </AdhocFilterPopoverTrigger>
);

export default AdhocFilterOption;

AdhocFilterOption.propTypes = propTypes;
