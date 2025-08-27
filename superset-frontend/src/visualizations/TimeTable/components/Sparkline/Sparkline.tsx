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
import { ReactElement } from 'react';
import { SparklineCell } from '..';
import {
  transformSparklineData,
  parseSparklineDimensions,
  validateYAxisBounds,
} from '../../utils';
import type { ColumnConfig, Entry } from '../../types';

interface SparklineProps {
  valueField: string;
  column: ColumnConfig;
  entries: Entry[];
}

/**
 * Renders a sparkline component with processed data
 */
const Sparkline = ({
  valueField,
  column,
  entries,
}: SparklineProps): ReactElement => {
  const sparkData = transformSparklineData(valueField, column, entries);
  const { width, height } = parseSparklineDimensions(column);
  const yAxisBounds = validateYAxisBounds(column.yAxisBounds);

  return (
    <SparklineCell
      ariaLabel={`spark-${valueField}`}
      width={width}
      height={height}
      data={sparkData}
      dataKey={`spark-${valueField}`}
      dateFormat={column.dateFormat || ''}
      numberFormat={column.d3format || ''}
      yAxisBounds={yAxisBounds}
      showYAxis={column.showYAxis || false}
      entries={entries}
    />
  );
};

export default Sparkline;
