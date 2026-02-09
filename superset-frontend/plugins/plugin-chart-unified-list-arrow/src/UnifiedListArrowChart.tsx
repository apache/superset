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
import { UnifiedListBarChartProps } from './types';
import { Styles } from './styles';
import { Row } from './components/Row';

export default function UnifiedListArrowChart(props: UnifiedListBarChartProps) {
    const { data, height, width, customize } = props;
    const { metricColumn, maxMetricColumn } = customize;

    console.log('UnifiedListBarChart render props:', props);

    // Calculate Max Metric for Bars if not provided via column
    let maxMetricValue = 0;
    if (maxMetricColumn) {
        // If a column is specified, we might take the max of that column across the dataset
        // or assume it's per-row. Re-reading reqs: "max_metric_column -> optional".
        // Usually "max" implies the denominator for the percentage calculation.
        // If provided, we likely want the max *value* in that column, or maybe it is the max target per row?
        // "percent = value / max_value" implies row-level max if it varies, or global max.
        // Let's assume global max of the max_metric_column for now, or fall back to max of metric_column.

        // Actually, if it's "max_metric: 20" in the example, it looks like a row-level target.
        // But for calculating bar width relative to each other, we usually want a global scale.
        // However, the example "16 / 20" suggests row-level target.
        // Let's handle both: if maxMetricColumn exists, use that record's value as denominator.
        // If NOT, find the global max of metricColumn.
    } else if (metricColumn) {
        maxMetricValue = Math.max(...data.map(d => (d[metricColumn] as number) || 0));
    }

    return (
        <Styles height={height} width={width}>
            {data.map((record, index) => {
                // Determine row-specific max
                let rowMax = maxMetricValue;
                if (maxMetricColumn) {
                    rowMax = (record[maxMetricColumn] as number) || 0;
                }

                return (
                    <Row
                        key={index}
                        record={record}
                        customize={customize}
                        maxMetricValue={rowMax}
                    />
                );
            })}
        </Styles>
    );
}
