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
import {
  ChartProps,
  ensureIsArray,
  getColumnLabel,
  getMetricLabel,
} from '@superset-ui/core';

interface ChordData {
  nodes: unknown[];
  matrix: unknown[][];
}

/**
 * Builds the symmetrical adjacency matrix that d3.chord expects, the way
 * the legacy explore_json endpoint used to server-side: nodes are the
 * union of source and target values, matrix[target][source] holds the
 * metric value.
 */
function buildChordData(
  records: Record<string, unknown>[],
  sourceLabel: string,
  targetLabel: string,
  metricLabel: string,
): ChordData {
  const nodes = Array.from(
    new Set(
      records.flatMap(record => [record[sourceLabel], record[targetLabel]]),
    ),
  );
  const values = new Map<unknown, Map<unknown, unknown>>();
  records.forEach(record => {
    const source = record[sourceLabel];
    if (!values.has(source)) {
      values.set(source, new Map());
    }
    values.get(source)!.set(record[targetLabel], record[metricLabel]);
  });
  return {
    nodes,
    matrix: nodes.map(target =>
      nodes.map(source => values.get(source)?.get(target) ?? 0),
    ),
  };
}

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData } = chartProps;
  const { yAxisFormat, colorScheme, sliceId, groupby, columns, metric } =
    formData;

  const rawData = queriesData[0].data;
  const data = Array.isArray(rawData)
    ? buildChordData(
        rawData,
        getColumnLabel(ensureIsArray(groupby)[0]),
        getColumnLabel(ensureIsArray(columns)[0]),
        getMetricLabel(metric),
      )
    : // legacy explore_json payloads arrive pre-shaped
      rawData;

  return {
    colorScheme,
    data,
    height,
    numberFormat: yAxisFormat,
    width,
    sliceId,
  };
}
