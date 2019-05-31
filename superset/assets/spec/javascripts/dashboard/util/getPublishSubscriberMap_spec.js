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

import getPublishSubscriberMap from '../../../../src/dashboard/util/getPublishSubscriberMap';

describe('getPublishSubscriberMap', () => {
  it('should return empty pubsubmap if 0 charts in dashboard', () => {
    const charts = [];
    const result = {
      publishers: undefined,
      subscribers: undefined
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for  1 publishers x 0 subscriber', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [], "viz_type": "table" } },
      subscribers: undefined
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 1 publishers x 1 subscriber (old linked_slice struct)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [1],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "useAsModal": false, "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "A", "op": "in", "actions": ["APPLY_FILTER"] }, { "col": "B", "op": "in", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 0 publishers x 1 subscriber (old linked_slice struct)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": [],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [1],
          "extras": {},
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: undefined,
      subscribers: undefined
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });

  it('should return  pubsubmap for only 0 publishers x 0 subscriber (old linked_slice struct)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": [],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [],
          "extras": {},
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: undefined,
      subscribers: undefined
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });

  it('should return  pubsubmap for only 1 publishers x 1 subscriber (old linked_slice struct and no extras)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [1],
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" } },
      subscribers: { "2": { "id": 2, "useAsModal": false, "viz_type": "leaflet_map", "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "A", "op": "in", "actions": ["APPLY_FILTER"] }, { "col": "B", "op": "in", "actions": ["APPLY_FILTER"] }] } } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 1 publishers x 1 subscriber (old linked_slice struct and no extras and no actions)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "linked_slice": [],
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "linked_slice": [1],
          "viz_type": "leaflet_map",
          "useAsModal": false,
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "actions": ["APPLY_FILTER"], "useAsModal": false, "linked_slices": { "1": [{ "col": "A", "op": "in", "actions": ["APPLY_FILTER"] }, { "col": "B", "op": "in", "actions": ["APPLY_FILTER"] }] } } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 0 publishers x 0 subscriber (old linked_slice struct and no extras and no actions)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": [],
          "linked_slice": [],
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "linked_slice": [],
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: undefined,
      subscribers: undefined
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 1 publishers x 1 subscriber (new linked_slice struct and subscribe all publish cols)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [{
            publisher_id: 1,
            subscribe_columns: [
              {
                col: 'A',
                op: '==',
                "actions": ["APPLY_FILTER"],
              },
              {
                col: 'B',
                op: '!=',
                "actions": ["APPLY_FILTER"],
              }
            ]
          }],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "useAsModal": false, "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "A", "op": "==", "actions": ["APPLY_FILTER"] }, { "col": "B", "op": "!=", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 1 publishers x 1 subscriber (new linked_slice struct and subscribe 1 publish cols)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [{
            publisher_id: 1,
            subscribe_columns: [
              {
                col: 'B',
                op: '!=',
                "actions": ["APPLY_FILTER"]
              }
            ]
          }],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "useAsModal": false, "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "B", "op": "!=", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 2 publishers x 1 subscriber (new linked_slice struct and subscribe mix publish cols)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 3,
        "formData": {
          "publish_columns": ["C"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "filter_box",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [{
            publisher_id: 1,
            subscribe_columns: [
              {
                col: "B",
                op: "!=",
                "actions": ["APPLY_FILTER"]
              }
            ]
          },
          {
            publisher_id: 3,
            subscribe_columns: [
              {
                col: "C",
                op: "in",
                "actions": ["APPLY_FILTER"]
              }
            ]
          }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" }, "3": { "id": 3, "publish_columns": ["C"], "subcribers": [2], "viz_type": "filter_box" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "useAsModal": false, "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "B", "op": "!=", "actions": ["APPLY_FILTER"] }], "3": [{ "col": "C", "op": "in", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 2 publishers x 2 subscriber (1:1) (new linked_slice struct and subscribe all publish cols)', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 3,
        "formData": {
          "publish_columns": ["C"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "filter_box",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [{
            publisher_id: 1,
            subscribe_columns: [
              {
                col: "B",
                op: "!=",
                "actions": ["APPLY_FILTER"]
              }
            ]
          }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      },
      {
        "id": 4,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [
            {
              publisher_id: 1,
              subscribe_columns: [
                {
                  col: "A",
                  op: ">=",
                  "actions": ["APPLY_FILTER"]
                }
              ]
            },
            {
              publisher_id: 3,
              subscribe_columns: [
                {
                  col: "C",
                  op: "in",
                  "actions": ["APPLY_FILTER"]
                }
              ]
            }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "table",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2, 4], "viz_type": "table" }, "3": { "id": 3, "publish_columns": ["C"], "subcribers": [4], "viz_type": "filter_box" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "useAsModal": false, "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "B", "op": "!=", "actions": ["APPLY_FILTER"] }] }, "extras": {} }, "4": { "id": 4, "useAsModal": false, "viz_type": "table", "actions": ["APPLY_FILTER"], "linked_slices": { "3": [{ "col": "C", "op": "in", "actions": ["APPLY_FILTER"] }], "1": [{ "col": "A", "op": ">=", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 2 publishers x 2 subscriber (2:1) (new linked_slice struct and subscribe all publish cols) ', () => {
    const charts = [
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 3,
        "formData": {
          "publish_columns": ["C"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "filter_box",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [{
            publisher_id: 1,
            subscribe_columns: [
              {
                col: "B",
                op: "!=",
                "actions": ["APPLY_FILTER"]
              }
            ]
          }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      },
      {
        "id": 4,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [
            {
              publisher_id: 3,
              subscribe_columns: [
                {
                  col: "C",
                  op: "in",
                  "actions": ["APPLY_FILTER"]
                }
              ]
            }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "table",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" }, "3": { "id": 3, "publish_columns": ["C"], "subcribers": [4], "viz_type": "filter_box" } },
      subscribers: { "2": { "id": 2, "viz_type": "leaflet_map", "useAsModal": false, "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "B", "op": "!=", "actions": ["APPLY_FILTER"] }] }, "extras": {} }, "4": { "id": 4, "useAsModal": false, "viz_type": "table", "actions": ["APPLY_FILTER"], "linked_slices": { "3": [{ "col": "C", "op": "in", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
  it('should return  pubsubmap for only 2 publishers x 2 subscriber (2:1) x 0 (new linked_slice struct and subscribe some publish cols)', () => {
    const charts = [
      {
        "id": 5,
        "formData": {
          "publish_columns": [],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 1,
        "formData": {
          "publish_columns": ["A", "B"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "table",
        },
      },
      {
        "id": 3,
        "formData": {
          "publish_columns": ["C"],
          "actions": [],
          "linked_slice": [],
          "extras": {},
          "viz_type": "filter_box",
        },
      },
      {
        "id": 2,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [{
            publisher_id: 1,
            subscribe_columns: [
              {
                col: "B",
                op: "!=",
                "actions": ["APPLY_FILTER"]
              }
            ]
          }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "leaflet_map",
        },
      },
      {
        "id": 4,
        "formData": {
          "publish_columns": [],
          "actions": ["APPLY_FILTER"],
          "linked_slice": [
            {
              publisher_id: 3,
              subscribe_columns: [
                {
                  col: "C",
                  op: "in",
                  "actions": ["APPLY_FILTER"]
                }
              ]
            }
          ],
          "extras": {},
          "useAsModal": false,
          "viz_type": "table",
        },
      }
    ];
    const result = {
      publishers: { "1": { "id": 1, "publish_columns": ["A", "B"], "subcribers": [2], "viz_type": "table" }, "3": { "id": 3, "publish_columns": ["C"], "subcribers": [4], "viz_type": "filter_box" } },
      subscribers: { "2": { "id": 2, "useAsModal": false, "viz_type": "leaflet_map", "actions": ["APPLY_FILTER"], "linked_slices": { "1": [{ "col": "B", "op": "!=", "actions": ["APPLY_FILTER"] }] }, "extras": {} }, "4": { "id": 4, "useAsModal": false, "viz_type": "table", "actions": ["APPLY_FILTER"], "linked_slices": { "3": [{ "col": "C", "op": "in", "actions": ["APPLY_FILTER"] }] }, "extras": {} } }
    };
    expect(getPublishSubscriberMap(charts)).toEqual(result);
  });
});
