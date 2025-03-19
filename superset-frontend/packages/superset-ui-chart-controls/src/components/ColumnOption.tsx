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
import { useState, ReactNode, useLayoutEffect, RefObject } from 'react';
import { css, SafeMarkdown, styled, SupersetTheme } from '@superset-ui/core';
import { Tooltip } from './Tooltip';
import { ColumnTypeLabel } from './ColumnTypeLabel/ColumnTypeLabel';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';
import { ColumnMeta } from '../types';
import {
  getColumnLabelText,
  getColumnTooltipNode,
  getColumnTypeTooltipNode,
} from './labelUtils';
import { SQLPopover } from './SQLPopover';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';

export type ColumnOptionProps = {
  column: ColumnMeta;
  showType?: boolean;
  labelRef?: RefObject<any>;
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
  const warningMarkdown =
    column.warning_markdown || column.warning_text || column.error_text;
  const type = hasExpression ? 'expression' : type_generic;
  const [tooltipText, setTooltipText] = useState<ReactNode>(column.column_name);
  const [columnTypeTooltipText, setcolumnTypeTooltipText] = useState<ReactNode>(
    column.type,
  );

  useLayoutEffect(() => {
    setTooltipText(getColumnTooltipNode(column, labelRef));
    setcolumnTypeTooltipText(getColumnTypeTooltipNode(column));
  }, [labelRef, column]);

  return (
    <StyleOverrides>
      {showType && type !== undefined && (
        <Tooltip
          id="metric-type-tooltip"
          title={columnTypeTooltipText}
          placement="bottomRight"
          align={{ offset: [8, -2] }}
        >
          <span>
            <ColumnTypeLabel type={type} />
          </span>
        </Tooltip>
      )}
      <Tooltip id="metric-name-tooltip" title={tooltipText}>
        <span
          className="option-label column-option-label"
          css={(theme: SupersetTheme) => css`
            margin-right: ${theme.gridUnit}px;
          `}
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
      {warningMarkdown && (
        <InfoTooltipWithTrigger
          className="text-warning"
          icon="warning"
          tooltip={<SafeMarkdown source={warningMarkdown} />}
          label={`warn-${column.column_name}`}
          iconsStyle={{ marginLeft: 0 }}
          {...(column.error_text && {
            className: 'text-danger',
            icon: 'exclamation-circle',
          })}
        />
      )}
    </StyleOverrides>
  );
}

export default ColumnOption;
