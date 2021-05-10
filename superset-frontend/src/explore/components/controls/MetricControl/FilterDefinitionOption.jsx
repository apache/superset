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

import columnType from './columnType';
import adhocMetricType from './adhocMetricType';
import { StyledColumnOption } from '../../optionRenderers';

const propTypes = {
  option: PropTypes.oneOfType([
    columnType,
    PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
    adhocMetricType,
  ]).isRequired,
};

export default function FilterDefinitionOption({ option }) {
  if (option.saved_metric_name) {
    return (
      <StyledColumnOption
        column={{ column_name: option.saved_metric_name, type: 'expression' }}
        showType
      />
    );
  }
  if (option.column_name) {
    return <StyledColumnOption column={option} showType />;
  }
  if (option.label) {
    return (
      <StyledColumnOption
        column={{ column_name: option.label, type: 'expression' }}
        showType
      />
    );
  }
}
FilterDefinitionOption.propTypes = propTypes;
