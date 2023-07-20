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
import { ChartProps, TimeseriesDataRecord } from '@superset-ui/core';
import cubejs from '@cubejs-client/core';

export default function transformProps(chartProps: ChartProps) {
  const { width, height, formData, queriesData, datasource } = chartProps;
  const {
    actionIdentifier,
    headerFontSize,
    headerText,
    blockingAction,
    allColumns,
    formConfig,
    extraFormData,
    buttonText,
  } = formData;
  const data = queriesData[0].data as TimeseriesDataRecord[];

  console.log('chartProps via TransformProps.ts', chartProps);

  // @ts-ignore
  const datasourceName = datasource.datasourceName;
  const dimentions = allColumns.map(
    (item: string) => datasourceName + '.' + item
  );
  const formObject = JSON.parse(formConfig);

  // const options = {
  //   apiToken: 'd60cb603dde98ba3037f2de9eda44938',
  //   apiUrl: 'http://93.119.15.212:4000/cubejs-api/v1',
  // };
  //
  // const cubejsApi = cubejs(options.apiToken, options);
  // cubejsApi
  //   .load({
  //     dimensions: dimentions,
  //     order: {
  //       'artikel.gewicht': 'asc',
  //     },
  //   })
  //   .then((result) => {
  //     console.log('Result: ');
  //     console.log(result);
  //   });

  return {
    width,
    height,
    data,
    // and now your control data, manipulated as needed, and passed through as props!
    actionIdentifier,
    headerFontSize,
    headerText,
    blockingAction,
    formObject,
    extraFormData,
    buttonText,
  };
}
