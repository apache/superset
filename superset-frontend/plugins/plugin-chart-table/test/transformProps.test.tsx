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
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { render, screen } from '@superset-ui/core/spec';
import { withChartDisplayLabels } from 'src/dashboard/util/withChartDisplayLabels';
import TableChart from '../src/TableChart';
import transformProps from '../src/transformProps';
import testData from './testData';

test('renders authorized chart display labels in table headers without changing data keys', () => {
  const datasource = withChartDisplayLabels(
    {
      chart_display_labels: {
        '12': { name: 'Person', sum__num: 'Population' },
        '13': { 'abc.com': 'Other chart column' },
      },
    },
    12,
  );
  const chartProps = new ChartProps({ datasource, theme: supersetTheme });
  const transformed = transformProps({
    ...testData.basic,
    datasource: chartProps.datasource,
  });

  render(<TableChart {...transformed} sticky={false} />);

  expect(
    screen.getByRole('columnheader', { name: /^Person/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('columnheader', { name: /^Population/ }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Other chart column')).not.toBeInTheDocument();
  expect(transformed.columns.map(column => column.key)).toEqual(
    testData.basic.queriesData[0].colnames,
  );
  expect(transformed.data[0]).toEqual(
    expect.objectContaining({ name: 'Michael', sum__num: 2467063 }),
  );
});
