/* eslint-disable no-magic-numbers */
import React from 'react';
import { SuperChart } from '@superset-ui/chart';
import 'bootstrap/dist/css/bootstrap.min.css';

const datasource = {
  columnFormats: {},
  verboseMap: {
    sum__num: 'sum__num',
  },
};

export default [
  {
    renderStory: () => (
      <SuperChart
        chartType="pivot-table"
        width={400}
        height={400}
        datasource={datasource}
        payload={{
          data: {
            columns: [['sum__num', 'other'], ['sum__num', 'All']],
            html:
              '<table border="1" class="dataframe dataframe table table-striped table-bordered table-condensed table-hover">\n  <thead>\n    <tr>\n      <th></th>\n      <th colspan="2" halign="left">sum__num</th>\n    </tr>\n    <tr>\n      <th>state</th>\n      <th>other</th>\n      <th>All</th>\n    </tr>\n    <tr>\n      <th>name</th>\n      <th></th>\n      <th></th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <th>Christopher</th>\n      <td>803607</td>\n      <td>803607</td>\n    </tr>\n    <tr>\n      <th>David</th>\n      <td>673992</td>\n      <td>673992</td>\n    </tr>\n    <tr>\n      <th>James</th>\n      <td>749686</td>\n      <td>749686</td>\n    </tr>\n    <tr>\n      <th>Jennifer</th>\n      <td>587540</td>\n      <td>587540</td>\n    </tr>\n    <tr>\n      <th>John</th>\n      <td>638450</td>\n      <td>638450</td>\n    </tr>\n    <tr>\n      <th>Joshua</th>\n      <td>548044</td>\n      <td>548044</td>\n    </tr>\n    <tr>\n      <th>Matthew</th>\n      <td>608212</td>\n      <td>608212</td>\n    </tr>\n    <tr>\n      <th>Michael</th>\n      <td>1047996</td>\n      <td>1047996</td>\n    </tr>\n    <tr>\n      <th>Robert</th>\n      <td>575592</td>\n      <td>575592</td>\n    </tr>\n    <tr>\n      <th>William</th>\n      <td>574464</td>\n      <td>574464</td>\n    </tr>\n    <tr>\n      <th>All</th>\n      <td>6807583</td>\n      <td>6807583</td>\n    </tr>\n  </tbody>\n</table>',
          },
        }}
        formData={{
          groupby: ['name'],
          numberFormat: '.3s',
        }}
      />
    ),
    storyName: 'Basic',
    storyPath: 'legacy-|plugin-chart-pivot-table|PivotTableChartPlugin',
  },
  {
    renderStory: () => (
      <SuperChart
        chartType="pivot-table"
        width={400}
        height={400}
        datasource={datasource}
        payload={{
          data: {
            columns: [['sum__num', 'other'], ['sum__num', 'All']],
            html:
              '<table border="1" class="dataframe dataframe table table-striped table-bordered table-condensed table-hover">\n  <thead>\n    <tr>\n      <th></th>\n      <th colspan="2" halign="left">sum__num</th>\n    </tr>\n    <tr>\n      <th>state</th>\n      <th>other</th>\n      <th>All</th>\n    </tr>\n    <tr>\n      <th>name</th>\n      <th></th>\n      <th></th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <th>Christopher</th>\n      <td>null</td>\n      <td>803607</td>\n    </tr>\n    <tr>\n      <th>David</th>\n      <td>null</td>\n      <td>673992</td>\n    </tr>\n    <tr>\n      <th>James</th>\n      <td>749686</td>\n      <td>null</td>\n    </tr>\n    <tr>\n      <th>Jennifer</th>\n      <td>587540</td>\n      <td>null</td>\n    </tr>\n    <tr>\n      <th>John</th>\n      <td>638450</td>\n      <td>638450</td>\n    </tr>\n    <tr>\n      <th>Joshua</th>\n      <td>null</td>\n      <td>548044</td>\n    </tr>\n    <tr>\n      <th>Matthew</th>\n      <td>608212</td>\n      <td>608212</td>\n    </tr>\n    <tr>\n      <th>Michael</th>\n      <td>1047996</td>\n      <td>1047996</td>\n    </tr>\n    <tr>\n      <th>Robert</th>\n      <td>575592</td>\n      <td>575592</td>\n    </tr>\n    <tr>\n      <th>William</th>\n      <td>574464</td>\n      <td>574464</td>\n    </tr>\n    <tr>\n      <th>All</th>\n      <td>6807583</td>\n      <td>6807583</td>\n    </tr>\n  </tbody>\n</table>',
          },
        }}
        formData={{
          groupby: ['name'],
          numberFormat: '.3s',
        }}
      />
    ),
    storyName: 'With null',
    storyPath: 'legacy-|plugin-chart-pivot-table|PivotTableChartPlugin',
  },
];
