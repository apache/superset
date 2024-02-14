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
import { ChartProps, DataRecord, Metric } from '@superset-ui/core';

interface FormData {
  groupby: string[];
  metrics: Array<object>;
  url: string;
  columnCollection: Array<object> | [];
}

interface QueryData {
  data: {
    records: DataRecord[];
    columns: string[];
  };
}

export type TableChartProps = ChartProps & {
  formData: FormData;
  queriesData: QueryData[];
};

interface ColumnData {
  timeLag?: string | number;
}
export default function transformProps(chartProps: TableChartProps) {
  const { height, datasource, formData, queriesData } = chartProps;
  const { columnCollection = [], groupby, metrics, url } = formData;
  const { records, columns } = queriesData[0].data;
  const isGroupBy = groupby?.length > 0;

  // When there is a "group by",
  // each row in the table is a database column
  // Otherwise each row in the table is a metric
  let rows;
  if (isGroupBy) {
    rows = columns.map(column =>
      typeof column === 'object' ? column : { label: column },
    );
  } else {
    /* eslint-disable */
    const metricMap = datasource.metrics.reduce(
      (acc, current) => {
        const map = acc;
        map[current.metric_name] = current;
        return map;
      },
      {} as Record<string, Metric>,
    );
    /* eslint-disable */
    rows = metrics.map(metric =>
      typeof metric === 'object' ? metric : metricMap[metric],
    );
  }

  // TODO: Better parse this from controls instead of mutative value here.
  columnCollection.forEach(column => {
    const c: ColumnData = column;
    if (typeof c.timeLag === 'string' && c.timeLag) {
      c.timeLag = parseInt(c.timeLag, 10);
    }
  });

  return {
    height,
    data: records,
    columnConfigs: columnCollection,
    rows,
    rowType: isGroupBy ? 'column' : 'metric',
    url,
  };
}
