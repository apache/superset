/* eslint-disable theme-colors/no-literal-colors */
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
import { sliceId } from './mockChartQueries';

export default {
  sliceIds: [sliceId],
  expandedSlices: {},
  editMode: false,
  hasUnsavedChanges: false,
  maxUndoHistoryExceeded: false,
  isStarred: true,
  isPublished: true,
  css: '',
  focusedFilterField: null,
  refreshFrequency: 0,
};

export const overwriteConfirmMetadata = {
  updatedAt: '2022-10-07T16:35:30.924212',
  updatedBy: 'Superset Admin',
  overwriteConfirmItems: [
    {
      keyPath: 'css',
      oldValue: '',
      newValue: `
  .navbar {
    transition: opacity 0.5s ease;
  }
`,
    },
    {
      keyPath: 'json_metadata.filter_scopes',
      oldValue: `{
  "122": {
    "ethnic_minority": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "gender": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "developer_type": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "lang_at_home": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "country_live": {
      "scope": ["ROOT_ID"],
      "immune": []
    }
  }
}`,
      newValue: `{
  "122": {
    "ethnic_minority": {
      "scope": ["ROOT_ID"],
      "immune": [
        131,
        115,
        123,
        89,
        94,
        71
      ]
    },
    "gender": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "developer_type": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "lang_at_home": {
      "scope": ["ROOT_ID"],
      "immune": []
    },
    "country_live": {
      "scope": ["ROOT_ID"],
      "immune": []
    }
  }
}`,
    },
  ],
  dashboardId: 9,
  data: {
    certified_by: '',
    certification_details: '',
    css: ".navbar {\n    transition: opacity 0.5s ease;\n    opacity: 0.05;\n}\n.navbar:hover {\n    opacity: 1;\n}\n.chart-header .header{\n    font-weight: @font-weight-normal;\n    font-size: 12px;\n}\n/*\nvar bnbColors = [\n    //rausch    hackb      kazan      babu      lima        beach     tirol\n    '#ff5a5f', '#7b0051', '#007A87', '#00d1c1', '#8ce071', '#ffb400', '#b4a76c',\n    '#ff8083', '#cc0086', '#00a1b3', '#00ffeb', '#bbedab', '#ffd266', '#cbc29a',\n    '#ff3339', '#ff1ab1', '#005c66', '#00b3a5', '#55d12e', '#b37e00', '#988b4e',\n ];\n*/\n",
    dashboard_title: 'FCC New Coder Survey 2018',
    slug: null,
    owners: [],
    json_metadata:
      '{"timed_refresh_immune_slices":[],"expanded_slices":{},"refresh_frequency":0,"default_filters":"{}","color_scheme":"supersetColors","label_colors":{"0":"#FCC700","1":"#A868B7","15":"#3CCCCB","30":"#A38F79","45":"#8FD3E4","age":"#1FA8C9","Yes,":"#1FA8C9","Female":"#454E7C","Prefer":"#5AC189","No,":"#FF7F44","Male":"#666666","Prefer not to say":"#E04355","Ph.D.":"#FCC700","associate\'s degree":"#A868B7","bachelor\'s degree":"#3CCCCB","high school diploma or equivalent (GED)":"#A38F79","master\'s degree (non-professional)":"#8FD3E4","no high school (secondary school)":"#A1A6BD","professional degree (MBA, MD, JD, etc.)":"#ACE1C4","some college credit, no degree":"#FEC0A1","some high school":"#B2B2B2","trade, technical, or vocational training":"#EFA1AA","No, not an ethnic minority":"#1FA8C9","Yes, an ethnic minority":"#454E7C","<NULL>":"#5AC189","Yes":"#FF7F44","No":"#666666","last_yr_income":"#E04355","More":"#A1A6BD","Less":"#ACE1C4","I":"#FEC0A1","expected_earn":"#B2B2B2","Yes: Willing To":"#EFA1AA","No: Not Willing to":"#FDE380","No Answer":"#D3B3DA","In an Office (with Other Developers)":"#9EE5E5","No Preference":"#D1C6BC","From Home":"#1FA8C9"},"color_scheme_domain":["#1FA8C9","#454E7C","#5AC189","#FF7F44","#666666","#E04355","#FCC700","#A868B7","#3CCCCB","#A38F79","#8FD3E4","#A1A6BD","#ACE1C4","#FEC0A1","#B2B2B2","#EFA1AA","#FDE380","#D3B3DA","#9EE5E5","#D1C6BC"],"shared_label_colors":{"Male":"#5ac19e","Female":"#1f86c9","<NULL>":"#5AC189","Prefer not to say":"#47457c","No Answer":"#e05043","Yes, an ethnic minority":"#666666","No, not an ethnic minority":"#ffa444","age":"#1FA8C9"},"cross_filters_enabled":false,"filter_scopes":{},"chart_configuration":{},"positions":{}}',
  },
};
