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

import PropTypes from 'prop-types';

import { ColumnMeta } from '@superset-ui/chart-controls';
import { InfoTooltip } from '@superset-ui/core/components';

const propTypes = {
  option: PropTypes.object.isRequired,
};

// This component provides a general tooltip for options
// in a SelectControl
// TODO use theme.sizeUnit once theme can be imported in plugins
export default function OptionDescription({ option }: { option: ColumnMeta }) {
  return (
    <span>
      <span className="option-label" style={{ marginRight: 4 }}>
        {option.label}
      </span>
      {option.description && (
        <InfoTooltip
          type="question"
          tooltip={option.description}
          label={`descr-${option.label}`}
        />
      )}
    </span>
  );
}
OptionDescription.propTypes = propTypes;
