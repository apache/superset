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
import { DatasourceType, supersetTheme } from '@superset-ui/core';
import transformProps from '../../src/Tree/transformProps';
import {
  EchartsTreeFormData,
  EchartsTreeChartProps,
  TreeChartDataResponseResult,
} from '../../src/Tree/types';

describe('EchartsTree transformProps', () => {
  const baseFormData: EchartsTreeFormData = {
    childLabelPosition: 'top',
    emphasis: 'ancestor',
    layout: 'radial',
    nodeLabelPosition: 'top',
    orient: 'LR',
    roam: 'scale',
    symbol: '',
    symbolSize: 0,
    colorScheme: 'bnbColors',
    datasource: '3__table',
    granularity_sqla: 'ds',
    metric: 'count',
    id: 'id_column',
    parent: 'relation_column',
    name: 'name_column',
    rootNodeId: '1',
    viz_type: 'tree',
  };
  const baseChartProps: EchartsTreeChartProps = {
    annotationData: {},
    behaviors: [],
    datasource: {
      id: 1,
      name: 'foo',
      type: DatasourceType.Table,
      columns: [],
      metrics: [],
    },
    filterState: {},
    formData: baseFormData,
    height: 600,
    hooks: {},
    initialValues: {},
    ownState: {},
    rawDatasource: {},
    rawFormData: baseFormData,
    theme: supersetTheme,
    width: 800,
    queriesData: [],
  };
  it('should transform when parent present before child', () => {
    const queriesData: TreeChartDataResponseResult[] = [
      {
        colnames: ['id_column', 'relation_column', 'name_column', 'count'],
        data: [
          {
            id_column: '1',
            // @ts-ignore
            relation_column: null,
            name_column: 'root',
            count: 10,
          },
          {
            id_column: '2',
            relation_column: '1',
            name_column: 'first_child',
            count: 10,
          },
          {
            id_column: '3',
            relation_column: '2',
            name_column: 'second_child',
            count: 10,
          },
          {
            id_column: '4',
            relation_column: '3',
            name_column: 'third_child',
            count: 10,
          },
        ],
      },
    ];

    const chartProps: EchartsTreeChartProps = {
      ...baseChartProps,
      queriesData,
    };
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  name: 'root',
                  children: [
                    {
                      name: 'first_child',
                      value: 10,
                      children: [
                        {
                          name: 'second_child',
                          value: 10,
                          children: [
                            { name: 'third_child', value: 10, children: [] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });
  it('should transform when child is present before parent', () => {
    const queriesData: TreeChartDataResponseResult[] = [
      {
        colnames: ['id_column', 'relation_column', 'name_column', 'count'],
        data: [
          {
            id_column: '1',
            // @ts-ignore
            relation_column: null,
            name_column: 'root',
            count: 10,
          },
          {
            id_column: '2',
            relation_column: '4',
            name_column: 'second_child',
            count: 20,
          },
          {
            id_column: '3',
            relation_column: '4',
            name_column: 'second_child',
            count: 30,
          },
          {
            id_column: '4',
            relation_column: '1',
            name_column: 'first_child',
            count: 40,
          },
        ],
      },
    ];

    const chartProps: EchartsTreeChartProps = {
      ...baseChartProps,
      queriesData,
    };
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  name: 'root',
                  children: [
                    {
                      name: 'first_child',
                      value: 40,
                      children: [
                        {
                          name: 'second_child',
                          value: 20,
                          children: [],
                        },
                        {
                          name: 'second_child',
                          value: 30,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });
  it('ignore node if not attached to root', () => {
    const formData = {
      ...baseFormData,
      rootNodeId: '2',
    };
    const queriesData: TreeChartDataResponseResult[] = [
      {
        colnames: ['id_column', 'relation_column', 'name_column', 'count'],
        data: [
          {
            id_column: '1',
            // @ts-ignore
            relation_column: null,
            name_column: 'root',
            count: 10,
          },
          {
            id_column: '2',
            relation_column: '1',
            name_column: 'first_child',
            count: 10,
          },
          {
            id_column: '3',
            relation_column: '2',
            name_column: 'second_child',
            count: 10,
          },
          {
            id_column: '4',
            relation_column: '3',
            name_column: 'third_child',
            count: 20,
          },
        ],
      },
    ];

    const chartProps: EchartsTreeChartProps = {
      ...baseChartProps,
      formData,
      rawFormData: formData,
      queriesData,
    };
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  name: 'first_child',
                  children: [
                    {
                      name: 'second_child',
                      value: 10,
                      children: [
                        {
                          name: 'third_child',
                          value: 20,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });
  it('should transform props if name column is not specified', () => {
    const formData: EchartsTreeFormData = {
      ...baseFormData,
      rootNodeId: '1',
    };
    const queriesData: TreeChartDataResponseResult[] = [
      {
        colnames: ['id_column', 'relation_column', 'count'],
        data: [
          {
            id_column: '1',
            // @ts-ignore
            relation_column: null,
            count: 10,
          },
          {
            id_column: '2',
            relation_column: '1',
            count: 10,
          },
          {
            id_column: '3',
            relation_column: '2',
            count: 10,
          },
          {
            id_column: '4',
            relation_column: '3',
            count: 20,
          },
        ],
      },
    ];

    const chartProps: EchartsTreeChartProps = {
      ...baseChartProps,
      formData,
      rawFormData: formData,
      queriesData,
    };
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  name: '1',
                  children: [
                    {
                      name: '2',
                      value: 10,
                      children: [
                        {
                          name: '3',
                          value: 10,
                          children: [
                            {
                              name: '4',
                              value: 20,
                              children: [],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });
  it('should find root node with null parent when root node name is not provided', () => {
    const queriesData: TreeChartDataResponseResult[] = [
      {
        colnames: ['id_column', 'relation_column', 'name_column', 'count'],
        data: [
          {
            id_column: '2',
            relation_column: '4',
            name_column: 'second_child',
            count: 20,
          },
          {
            id_column: '3',
            relation_column: '4',
            name_column: 'second_child',
            count: 30,
          },
          {
            id_column: '4',
            relation_column: '1',
            name_column: 'first_child',
            count: 40,
          },
          {
            id_column: '1',
            // @ts-ignore
            relation_column: null,
            name_column: 'root',
            count: 10,
          },
        ],
      },
    ];

    const chartProps: EchartsTreeChartProps = {
      ...baseChartProps,
      queriesData,
    };
    expect(transformProps(chartProps)).toEqual(
      expect.objectContaining({
        width: 800,
        height: 600,
        echartOptions: expect.objectContaining({
          series: expect.arrayContaining([
            expect.objectContaining({
              data: [
                {
                  name: 'root',
                  children: [
                    {
                      name: 'first_child',
                      value: 40,
                      children: [
                        {
                          name: 'second_child',
                          value: 20,
                          children: [],
                        },
                        {
                          name: 'second_child',
                          value: 30,
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            }),
          ]),
        }),
      }),
    );
  });
});
