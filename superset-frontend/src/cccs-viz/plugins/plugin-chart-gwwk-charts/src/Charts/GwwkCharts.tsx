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
import { getURIDirectory } from 'src/explore/exploreUtils';
import { safeStringify } from 'src/utils/safeStringify';
import { GwwkChartsProps } from '../types';
import { Container, Table, Td, Tr } from '../utils';
/* eslint camelcase: 0 */
const URI = require('urijs');

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

function buildUrl(id: string, filter_name: string, selected_values: string[]) {
  const adhoc_filters = [
    {
      clause: 'WHERE',
      comparator: selected_values,
      expressionType: 'SIMPLE',
      operator: 'IN',
      subject: filter_name,
    },
  ];

  const formData = {
    slice_id: id,
    adhoc_filters,
    time_range: 'No filter',
  };

  const uri = new URI('/');
  const directory = getURIDirectory('base');
  const search = uri.search(true);

  // Building the querystring (search) part of the URI
  search.form_data = safeStringify(formData);
  const url = uri.search(search).directory(directory).toString();
  return url;
}

export default function GwwkCharts(props: GwwkChartsProps) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const { selected_values, data, height, width } = props;
  return (
    <Container style={{ height, width }}>
      <h3>Charts for {selected_values.join(', ')}</h3>
      <Table>
        <tbody>
          {data.map((row: any) => {
            const url = buildUrl(row.id, row.filter_name, selected_values);
            return (
              <Tr>
                <Td>
                  <a href={url}>
                    <span style={{ fontWeight: 'bold' }}>{row.name}</span>
                  </a>
                </Td>
                <Td>
                  <span style={{ fontWeight: 'normal' }}>
                    by {row.filter_name}
                  </span>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>
    </Container>
  );
}
