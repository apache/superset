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
import getFormDataWithExtraFilters from '../../../../src/dashboard/util/charts/getFormDataWithExtraFilters';

describe('getFormDataWithExtraFilters', () => {
  const chartId = 'chartId';
  const mockArgs = {
    chart: {
      id: chartId,
      formData: {
        filters: [
          {
            col: 'country_name',
            op: 'in',
            val: ['United States'],
          },
        ]
      },
    },
    dashboardMetadata: {
      filter_immune_slices: [],
      filter_immune_slice_fields: {},
    },
    filters: {
      filterId: {
        region: ['Spain'],
        color: ['pink', 'purple'],
      },
    },
    sliceId: chartId,
    publishSubscriberMap: {
      publishers: undefined,
      subscribers: {
        chartId: {
          actions: [
            "APPLY_FILTER"
          ],
          linked_slices: {
            filterId: [
              { col: 'region',op: 'in'},
              { col: 'color', op: 'in'},
            ]
          }
        }
      }
    },
  };

  it('should include filters from the passed filters', () => {
    const result = getFormDataWithExtraFilters(mockArgs);
    expect(result.extra_filters).toHaveLength(2);
    expect(result.extra_filters[0]).toEqual({
      col: 'region',
      op: 'in',
      val: ['Spain'],
    });
    expect(result.extra_filters[1]).toEqual({
      col: 'color',
      op: 'in',
      val: ['pink', 'purple'],
    });
  });

  it('should include filters with __time_range also', () => {
    const result = getFormDataWithExtraFilters({ 
      ...mockArgs,
      filters: {
        filterId: {
          region: ['Spain'],
          color: ['pink', 'purple'],
          __time_range: "No Filter",
        },
      },
    });
    expect(result.extra_filters).toHaveLength(3);
  });

  it('should include filter applied by the slice dont apply to itself', () => {
    const result = getFormDataWithExtraFilters({ 
      ...mockArgs,
      filters: {
        chartId: {
          region: ['Spain'],
          color: ['pink', 'purple'],
          __time_range: "No Filter",
        },
      },
      publishSubscriberMap: {
        publishers: undefined,
        subscribers: {
          chartId: {
            actions: [
              "APPLY_FILTER"
            ],
            linked_slices: {
              chartId: [
                { col: 'region',op: 'in'},
                { col: 'color', op: 'in'},
              ]
            }
          }
        }
      },
    });

    const result2 = getFormDataWithExtraFilters({ 
      ...mockArgs,
      filters: {
        chartId: {
          region: ['Spain'],
          color: ['pink', 'purple'],
          __time_range: "No Filter",
        },
      },
    });
    expect(result.extra_filters).toHaveLength(0);
    expect(result2.extra_filters).toHaveLength(0);
  });


  it('Convert filter column value from string to array in case of operator in', () => {
    const result = getFormDataWithExtraFilters({ 
        ...mockArgs,
        filters: {
          filterId: {
            region: 'Spain',
          },
        },  
        publishSubscriberMap: {
          publishers: undefined,
          subscribers: {
            chartId: {
              actions: [
                "APPLY_FILTER"
              ],
              linked_slices: {
                filterId: [
                  { col: 'region',op: 'in'},
                ]
              }
            }
          }
        }
    });

    const result2 = getFormDataWithExtraFilters({ 
        ...mockArgs,
        filters: {
          filterId: {
            region: 'Spain',
          },
        },  
        publishSubscriberMap: {
            publishers: undefined,
            subscribers: {
              chartId: {
                actions: [
                  "APPLY_FILTER"
                ],
                linked_slices: {
                  filterId: [
                    { col: 'region',op: '=='},
                  ]
                }
              }
            }
        }
    });
    
    expect(result.extra_filters).toHaveLength(1);
    expect(result.extra_filters[0]['val']).toEqual(['Spain']);

    expect(result2.extra_filters).toHaveLength(1);
    expect(result2.extra_filters[0]['val']).toEqual('Spain');
  });

  it('should include filters from the passed filters with equal operator && convert  filter column value from Array to string in case of operator except "in"|"not in"', () => {
    const result = getFormDataWithExtraFilters({ 
      ...mockArgs,
      publishSubscriberMap: {
        publishers: undefined,
        subscribers: {
          chartId: {
            actions: [
              "APPLY_FILTER"
            ],
            linked_slices: {
              filterId: [
                { col: 'region',op: '=='},
                { col: 'color', op: '=='},
              ]
            }
          }
        }
      },
    });
    expect(result.extra_filters).toHaveLength(3);
  });

  it('should include filters only when subscribers have action APPLY_FILTER', () => {
    const result = getFormDataWithExtraFilters({ 
      ...mockArgs,
      publishSubscriberMap: {
        publishers: undefined,
        subscribers: {
          chartId: {
            actions: [
              "APPLY_SCHEMA"
            ],
            linked_slices: {
              filterId: [
                { col: 'region',op: '=='},
                { col: 'color', op: '=='},
              ]
            }
          }
        }
      },
    });
    expect(result.extra_filters).toHaveLength(0);
  });

  it('should not add additional filters if the slice is immune to them', () => {
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      dashboardMetadata: {
        filter_immune_slices: [chartId],
      },
  });
    expect(result.extra_filters).toHaveLength(0);
  });

  it('should not add additional filters for fields to which the slice is immune', () => {
    const result = getFormDataWithExtraFilters({
      ...mockArgs,
      dashboardMetadata: {
        filter_immune_slice_fields: {
          [chartId]: ['region'],
        },
      },
    });
    expect(result.extra_filters).toHaveLength(1);
  });
});
