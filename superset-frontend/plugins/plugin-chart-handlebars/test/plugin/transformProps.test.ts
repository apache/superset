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
import { ChartProps, QueryFormData, supersetTheme } from '@superset-ui/core';
import { HandlebarsQueryFormData } from '../../src/types';
import transformProps from '../../src/plugin/transformProps';

describe('Handlebars transformProps', () => {
  const formData: HandlebarsQueryFormData = {
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularitySqla: 'ds',
    metric: 'sum__num',
    groupby: ['name'],
    width: 500,
    height: 500,
    viz_type: 'handlebars',
  };
  const data = [{ name: 'Hulk', sum__num: 1, __timestamp: 599616000000 }];
  const chartProps = new ChartProps<QueryFormData>({
    formData,
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
  });

  it('should transform chart props for viz', () => {
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        data,
      }),
    );
  });
});
