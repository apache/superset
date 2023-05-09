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
import React, { ReactNode } from 'react';

import { css, styled, t } from '@superset-ui/core';
import { ColumnMeta, Metric } from '@superset-ui/chart-controls';

const TooltipSectionWrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    font-size: ${theme.typography.sizes.s}px;
    line-height: 1.2;

    &:not(:last-of-type) {
      margin-bottom: ${theme.gridUnit * 2}px;
    }
  `}
`;

const TooltipSectionLabel = styled.span`
  ${({ theme }) => css`
    font-weight: ${theme.typography.weights.bold};
  `}
`;

const TooltipSection = ({
  label,
  text,
}: {
  label: ReactNode;
  text: ReactNode;
}) => (
  <TooltipSectionWrapper>
    <TooltipSectionLabel>{label}</TooltipSectionLabel>
    <span>{text}</span>
  </TooltipSectionWrapper>
);

export const isLabelTruncated = (labelRef?: React.RefObject<any>): boolean =>
  !!(labelRef?.current?.scrollWidth > labelRef?.current?.clientWidth);

export const getColumnLabelText = (column: ColumnMeta): string =>
  column.verbose_name || column.column_name;

export const getColumnTypeTooltipNode = (column: ColumnMeta): ReactNode => {
  if (!column.type) {
    return null;
  }

  return (
    <TooltipSection
      label={t('Column datatype')}
      text={column.type.toLowerCase()}
    />
  );
};

export const getColumnTooltipNode = (
  column: ColumnMeta,
  labelRef?: React.RefObject<any>,
): ReactNode => {
  if (
    (!column.column_name || !column.verbose_name) &&
    !column.description &&
    !isLabelTruncated(labelRef)
  ) {
    return null;
  }

  return (
    <>
      {column.column_name && (
        <TooltipSection label={t('Column name')} text={column.column_name} />
      )}
      {column.verbose_name && (
        <TooltipSection label={t('Label')} text={column.verbose_name} />
      )}
      {column.description && (
        <TooltipSection label={t('Description')} text={column.description} />
      )}
    </>
  );
};

type MetricType = Omit<Metric, 'id'> & { label?: string };

export const getMetricTooltipNode = (
  metric: MetricType,
  labelRef?: React.RefObject<any>,
): ReactNode => {
  if (
    !metric.verbose_name &&
    !metric.description &&
    !metric.label &&
    !isLabelTruncated(labelRef)
  ) {
    return null;
  }

  return (
    <>
      <TooltipSection label={t('Metric name')} text={metric.metric_name} />
      {(metric.label || metric.verbose_name) && (
        <TooltipSection
          label={t('Label')}
          text={metric.label || metric.verbose_name}
        />
      )}
      {metric.description && (
        <TooltipSection label={t('Description')} text={metric.description} />
      )}
    </>
  );
};
