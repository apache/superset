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
import Column from './Column';
import FormData from './FormData';

export const LABEL_MAX_LENGTH = 43;

// Note that the values of MetricKeys are lower_snake_case because they're
// used as keys of form data jsons.
export enum MetricKey {
  METRIC = 'metric',
  METRICS = 'metrics',
  PERCENT_METRICS = 'percent_metrics',
  RIGHT_AXIS_METRIC = 'metric_2',
  SECONDARY_METRIC = 'secondary_metric',
  X = 'x',
  Y = 'y',
  SIZE = 'size',
}

export enum Aggregate {
  AVG = 'AVG',
  COUNT = 'COUNT ',
  COUNT_DISTINCT = 'COUNT_DISTINCT',
  MAX = 'MAX',
  MIN = 'MIN',
  SUM = 'SUM',
}

export enum ExpressionType {
  SIMPLE = 'SIMPLE',
  SQL = 'SQL',
}

interface AdhocMetricSimple {
  expressionType: ExpressionType.SIMPLE;
  column: Column;
  aggregate: Aggregate;
}

interface AdhocMetricSQL {
  expressionType: ExpressionType.SQL;
  sqlExpression: string;
}

export type AdhocMetric = {
  label?: string,
  optionName?: string,
} & (AdhocMetricSimple | AdhocMetricSQL);

type Metric = {
  label: string;
} & Partial<AdhocMetric>;

export default Metric;

export class Metrics {
  // Use Array to maintain insertion order for metrics that are order sensitive
  private metrics: Metric[];

  constructor(formData: FormData) {
    this.metrics = [];
    for (const key of Object.keys(MetricKey)) {
      const metric = formData[MetricKey[key] as MetricKey];
      if (metric) {
        if (typeof metric === 'string') {
          this.metrics.push({
            label: metric,
          });
        } else {
          // Note we further sanitize the metric label for BigQuery datasources
          // TODO: move this logic to the client once client has more info on the
          // the datasource
          const label = metric.label || this.getDefaultLabel(metric);
          this.metrics.push({
            ...metric,
            label,
          });
        }
      }
    }
  }

  public getMetrics() {
    return this.metrics;
  }

  public getLabels() {
    return this.metrics.map((m) => m.label);
  }

  private getDefaultLabel(metric: AdhocMetric) {
    let label: string;
    if (metric.expressionType === ExpressionType.SIMPLE) {
      label = `${metric.aggregate}(${(metric.column.columnName)})`;
    } else {
      label = metric.sqlExpression;
    }
    return label.length <= LABEL_MAX_LENGTH ? label :
      `${label.substring(0, LABEL_MAX_LENGTH - 3)}...`;
  }
}
