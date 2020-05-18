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

import { InfoTooltipWithTrigger } from '@superset-ui/control-utils';
import ColumnTypeLabel from './ColumnTypeLabel';

const propTypes = {
  column: PropTypes.object.isRequired,
  showType: PropTypes.bool,
};
const defaultProps = {
  showType: false,
};

export default function ColumnOption({ column, showType }) {
  const hasExpression =
    column.expression && column.expression !== column.column_name;

  let columnType = column.type;
  if (column.is_dttm) {
    columnType = 'time';
  } else if (hasExpression) {
    columnType = 'expression';
  }

  return (
    <span>
      {showType && columnType && <ColumnTypeLabel type={columnType} />}
      <span className="m-r-5 option-label">
        {column.verbose_name || column.column_name}
      </span>
      {column.description && (
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={column.description}
          label={`descr-${column.column_name}`}
        />
      )}
      {hasExpression && (
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={column.expression}
          label={`expr-${column.column_name}`}
        />
      )}
    </span>
  );
}
ColumnOption.propTypes = propTypes;
ColumnOption.defaultProps = defaultProps;
