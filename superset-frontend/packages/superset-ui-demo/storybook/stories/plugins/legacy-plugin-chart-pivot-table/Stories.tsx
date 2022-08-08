/*
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

/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/core';
import PivotTableChartPlugin from '@superset-ui/legacy-plugin-chart-pivot-table';
import 'bootstrap/dist/css/bootstrap.min.css';

new PivotTableChartPlugin().configure({ key: 'pivot-table' }).register();

export default {
  title: 'Legacy Chart Plugins/legacy-plugin-chart-pivot-table',
};

const datasource = {
  columnFormats: {},
  verboseMap: {
    sum__num: 'sum__num',
  },
};

export const basic = () => (
  <SuperChart
    chartType="pivot-table"
    width={400}
    height={400}
    datasource={datasource}
    queriesData={[
      {
        data: {
          columns: [
            ['sum__num', 'other'],
            ['sum__num', 'All'],
          ],
          html: `<table border="1" class="dataframe dataframe table table-striped table-bordered table-condensed table-hover">
  <thead>
    <tr>
      <th></th>
      <th colspan="2" halign="left">sum__num</th>
    </tr>
    <tr>
      <th>state</th>
      <th>other</th>
      <th>All</th>
    </tr>
    <tr>
      <th>name</th>
      <th></th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th><a href="https://superset.apache.org">Apache Superset</a></th>
      <td>803607</td>
      <td>803607</td>
    </tr>
    <tr>
      <th>David <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMUXn76JAAEqgJQrlGqUwAAAABJRU5ErkJggg==" width="20" height="20" alt="pixel" /></th>
      <td>673992</td>
      <td>673992</td>
    </tr>
    <tr>
      <th><a href="https://superset.apache.org" target="_blank"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mMUXn76JAAEqgJQrlGqUwAAAABJRU5ErkJggg==" width="20" height="20" alt="pixel" />Apache Superset</a></th>
      <td>749686</td>
      <td>749686</td>
    </tr>
    <tr>
      <th>Jennifer</th>
      <td>587540</td>
      <td>587540</td>
    </tr>
    <tr>
      <th>John</th>
      <td>638450</td>
      <td>638450</td>
    </tr>
    <tr>
      <th>Joshua</th>
      <td>548044</td>
      <td>548044</td>
    </tr>
    <tr>
      <th>Matthew</th>
      <td>608212</td>
      <td>608212</td>
    </tr>
    <tr>
      <th>Michael</th>
      <td>1047996</td>
      <td>1047996</td>
    </tr>
    <tr>
      <th>Robert</th>
      <td>575592</td>
      <td>575592</td>
    </tr>
    <tr>
      <th>William</th>
      <td>574464</td>
      <td>574464</td>
    </tr>
    <tr>
      <th>All</th>
      <td>6807583</td>
      <td>6807583</td>
    </tr>
  </tbody>
</table>`,
        },
      },
    ]}
    formData={{
      groupby: ['name'],
      numberFormat: '.3s',
    }}
  />
);

export const withNull = () => (
  <SuperChart
    chartType="pivot-table"
    width={400}
    height={400}
    datasource={datasource}
    queriesData={[
      {
        data: {
          columns: [
            ['sum__num', 'other'],
            ['sum__num', 'All'],
          ],
          html: '<table border="1" class="dataframe dataframe table table-striped table-bordered table-condensed table-hover">\n  <thead>\n    <tr>\n      <th></th>\n      <th colspan="2" halign="left">sum__num</th>\n    </tr>\n    <tr>\n      <th>state</th>\n      <th>other</th>\n      <th>All</th>\n    </tr>\n    <tr>\n      <th>name</th>\n      <th></th>\n      <th></th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <th>Christopher</th>\n      <td>null</td>\n      <td>803607</td>\n    </tr>\n    <tr>\n      <th>David</th>\n      <td>null</td>\n      <td>673992</td>\n    </tr>\n    <tr>\n      <th>James</th>\n      <td>749686</td>\n      <td>null</td>\n    </tr>\n    <tr>\n      <th>Jennifer</th>\n      <td>587540</td>\n      <td>null</td>\n    </tr>\n    <tr>\n      <th>John</th>\n      <td>638450</td>\n      <td>638450</td>\n    </tr>\n    <tr>\n      <th>Joshua</th>\n      <td>null</td>\n      <td>548044</td>\n    </tr>\n    <tr>\n      <th>Matthew</th>\n      <td>608212</td>\n      <td>608212</td>\n    </tr>\n    <tr>\n      <th>Michael</th>\n      <td>1047996</td>\n      <td>1047996</td>\n    </tr>\n    <tr>\n      <th>Robert</th>\n      <td>575592</td>\n      <td>575592</td>\n    </tr>\n    <tr>\n      <th>William</th>\n      <td>574464</td>\n      <td>574464</td>\n    </tr>\n    <tr>\n      <th>All</th>\n      <td>6807583</td>\n      <td>6807583</td>\n    </tr>\n  </tbody>\n</table>',
        },
      },
    ]}
    formData={{
      groupby: ['name'],
      numberFormat: '.3s',
    }}
  />
);
