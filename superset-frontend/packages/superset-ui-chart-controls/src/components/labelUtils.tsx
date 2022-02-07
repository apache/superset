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

import { t } from '@superset-ui/core';
import { ColumnMeta, Metric } from '@superset-ui/chart-controls';

export const isLabelTruncated = (labelRef?: React.RefObject<any>): boolean =>
  !!(
    labelRef &&
    labelRef.current &&
    labelRef.current.scrollWidth > labelRef.current.clientWidth
  );

export const getColumnLabelText = (column: ColumnMeta): string =>
  column.verbose_name || column.column_name;

export const getColumnTooltipNode = (
  column: ColumnMeta,
  labelRef?: React.RefObject<any>,
): ReactNode => {
  // don't show tooltip if it hasn't verbose_name and hasn't truncated
  if (!column.verbose_name && !isLabelTruncated(labelRef)) {
    return null;
  }

  if (column.verbose_name) {
    return (
      <>
        <div>{t('column name: %s', column.column_name)}</div>
        <div>{t('verbose name: %s', column.verbose_name)}</div>
      </>
    );
  }

  // show column name in tooltip when column truncated
  return t('column name: %s', column.column_name);
};

type MetricType = Omit<Metric, 'id'> & { label?: string };

export const getMetricTooltipNode = (
  metric: MetricType,
  labelRef?: React.RefObject<any>,
): ReactNode => {
  // don't show tooltip if it hasn't verbose_name, label and hasn't truncated
  if (!metric.verbose_name && !metric.label && !isLabelTruncated(labelRef)) {
    return null;
  }

  if (metric.verbose_name) {
    return (
      <>
        <div>{t('metric name: %s', metric.metric_name)}</div>
        <div>{t('verbose name: %s', metric.verbose_name)}</div>
      </>
    );
  }

  if (isLabelTruncated(labelRef) && metric.label) {
    return t('label name: %s', metric.label);
  }

  return t('metric name: %s', metric.metric_name);
};
