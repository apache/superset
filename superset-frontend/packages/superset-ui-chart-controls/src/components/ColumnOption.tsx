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
import React, { useEffect, useState, ReactNode } from 'react';
import { styled } from '@superset-ui/core';
import { Tooltip } from './Tooltip';
import { ColumnTypeLabel } from './ColumnTypeLabel';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';
import { ColumnMeta } from '../types';
import { getColumnLabelText, getColumnTooltipNode } from './labelUtils';

export type ColumnOptionProps = {
  column: ColumnMeta;
  showType?: boolean;
  labelRef?: React.RefObject<any>;
};

const StyleOverrides = styled.span`
  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

export function ColumnOption({
  column,
  labelRef,
  showType = false,
}: ColumnOptionProps) {
  const { expression, column_name, type_generic } = column;
  const hasExpression = expression && expression !== column_name;
  const type = hasExpression ? 'expression' : type_generic;
  const [tooltipText, setTooltipText] = useState<ReactNode>(column.column_name);

  useEffect(() => {
    setTooltipText(getColumnTooltipNode(column, labelRef));
  }, [labelRef, column]);

  return (
    <StyleOverrides>
      {showType && type !== undefined && <ColumnTypeLabel type={type} />}
      {column.is_certified && (
        <CertifiedIconWithTooltip
          metricName={column.metric_name}
          certifiedBy={column.certified_by}
          details={column.certification_details}
        />
      )}
      <Tooltip
        id="metric-name-tooltip"
        title={tooltipText}
        trigger={['hover']}
        placement="top"
      >
        <span className="m-r-5 option-label column-option-label" ref={labelRef}>
          {getColumnLabelText(column)}
        </span>
      </Tooltip>

      {column.description && (
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="info"
          tooltip={column.description}
          label={`descr-${column.column_name}`}
          placement="top"
        />
      )}
      {hasExpression && (
        <InfoTooltipWithTrigger
          className="m-r-5 text-muted"
          icon="question-circle-o"
          tooltip={column.expression}
          label={`expr-${column.column_name}`}
          placement="top"
        />
      )}
    </StyleOverrides>
  );
}

export default ColumnOption;
