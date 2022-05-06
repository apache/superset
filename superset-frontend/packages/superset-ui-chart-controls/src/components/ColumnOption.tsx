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
import React, { useState, ReactNode, useLayoutEffect } from 'react';
import { css, styled, SupersetTheme } from '@superset-ui/core';
import { Tooltip } from './Tooltip';
import { ColumnTypeLabel } from './ColumnTypeLabel/ColumnTypeLabel';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';
import { ColumnMeta } from '../types';
import { getColumnLabelText, getColumnTooltipNode } from './labelUtils';
import { SQLPopover } from './SQLPopover';

export type ColumnOptionProps = {
  column: ColumnMeta;
  showType?: boolean;
  labelRef?: React.RefObject<any>;
};

const StyleOverrides = styled.span`
  display: flex;
  align-items: center;
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

  useLayoutEffect(() => {
    setTooltipText(getColumnTooltipNode(column, labelRef));
  }, [labelRef, column]);

  return (
    <StyleOverrides>
      {showType && type !== undefined && <ColumnTypeLabel type={type} />}
      <Tooltip id="metric-name-tooltip" title={tooltipText}>
        <span
          className="option-label column-option-label"
          css={(theme: SupersetTheme) =>
            css`
              margin-right: ${theme.gridUnit}px;
            `
          }
          ref={labelRef}
        >
          {getColumnLabelText(column)}
        </span>
      </Tooltip>
      {hasExpression && <SQLPopover sqlExpression={expression} />}
      {column.is_certified && (
        <CertifiedIconWithTooltip
          metricName={column.metric_name}
          certifiedBy={column.certified_by}
          details={column.certification_details}
        />
      )}
    </StyleOverrides>
  );
}

export default ColumnOption;
