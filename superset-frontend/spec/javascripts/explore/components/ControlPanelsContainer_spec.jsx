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
import { shallow } from 'enzyme';
import { getChartControlPanelRegistry } from '@superset-ui/chart';
import { t } from '@superset-ui/translation';
import { defaultControls } from 'src/explore/store';
import { getFormDataFromControls } from 'src/explore/controlUtils';
import { ControlPanelsContainer } from 'src/explore/components/ControlPanelsContainer';
import ControlPanelSection from 'src/explore/components/ControlPanelSection';

describe('ControlPanelsContainer', () => {
  let wrapper;

  beforeAll(() => {
    getChartControlPanelRegistry().registerValue('table', {
      controlPanelSections: [
        {
          label: t('GROUP BY'),
          description: t(
            'Use this section if you want a query that aggregates',
          ),
          expanded: true,
          controlSetRows: [
            ['groupby'],
            ['metrics'],
            ['percent_metrics'],
            ['timeseries_limit_metric', 'row_limit'],
            ['include_time', 'order_desc'],
          ],
        },
        {
          label: t('NOT GROUPED BY'),
          description: t('Use this section if you want to query atomic rows'),
          expanded: true,
          controlSetRows: [
            ['all_columns'],
            ['order_by_cols'],
            ['row_limit', null],
          ],
        },
        {
          label: t('Query'),
          expanded: true,
          controlSetRows: [['adhoc_filters']],
        },
        {
          label: t('Options'),
          expanded: true,
          controlSetRows: [
            ['table_timestamp_format'],
            ['page_length', null],
            ['include_search', 'table_filter'],
            ['align_pn', 'color_pn'],
          ],
        },
      ],
    });
  });

  afterAll(() => {
    getChartControlPanelRegistry().remove('table');
  });

  function getDefaultProps() {
    return {
      datasource_type: 'table',
      actions: {},
      controls: defaultControls,
      // Note: default viz_type is table
      form_data: getFormDataFromControls(defaultControls),
      isDatasourceMetaLoading: false,
      exploreState: {},
    };
  }

  it('renders ControlPanelSections', () => {
    wrapper = shallow(<ControlPanelsContainer {...getDefaultProps()} />);
    expect(wrapper.find(ControlPanelSection)).toHaveLength(6);
  });
});
