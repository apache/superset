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
import { render, screen } from '@testing-library/react';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import DatasourcePanel from 'src/explore/components/DatasourcePanel';

describe('datasourcepanel', () => {
  const datasource = {
    name: 'birth_names',
    type: 'table',
    uid: '1__table',
    id: 1,
    columns: [],
    metrics: [],
    database: {
      backend: 'mysql',
      name: 'main',
    },
  };
  const props = {
    datasource,
    controls: {
      datasource: {
        validationErrors: null,
        mapStateToProps: () => null,
        type: 'DatasourceControl',
        label: 'hello',
        datasource,
      },
    },
    actions: null,
  };
  it('should render', () => {
    const { container } = render(
      <ThemeProvider theme={supersetTheme}>
        <DatasourcePanel {...props} />
      </ThemeProvider>,
    );
    expect(container).toBeVisible();
  });

  it('should display items in controls', () => {
    render(
      <ThemeProvider theme={supersetTheme}>
        <DatasourcePanel {...props} />
      </ThemeProvider>,
    );
    expect(screen.getByText('birth_names')).toBeTruthy();
    expect(screen.getByText('Columns')).toBeTruthy();
    expect(screen.getByText('Metrics')).toBeTruthy();
  });
});
