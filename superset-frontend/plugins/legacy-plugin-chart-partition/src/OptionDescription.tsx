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

import {
  ColumnMeta,
  InfoTooltipWithTrigger,
} from '@superset-ui/chart-controls';

const propTypes = {
  option: PropTypes.object.isRequired,
};

// This component provides a general tooltip for options
// in a SelectControl
export default function OptionDescription({ option }: { option: ColumnMeta }) {
  return (
    <span>
      <span className="m-r-5 option-label">{option.label}</span>
      {option.description && (
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={option.description}
          label={`descr-${option.label}`}
        />
      )}
    </span>
  );
}
OptionDescription.propTypes = propTypes;
