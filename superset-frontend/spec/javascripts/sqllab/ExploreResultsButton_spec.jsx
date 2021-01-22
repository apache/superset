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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import shortid from 'shortid';
import sqlLabReducer from 'src/SqlLab/reducers/index';
import ExploreResultsButton from 'src/SqlLab/components/ExploreResultsButton';
import * as exploreUtils from 'src/explore/exploreUtils';
import Button from 'src/components/Button';

import { queries, queryWithBadColumns } from './fixtures';

describe('ExploreResultsButton', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const database = {
    allows_subquery: true,
  };
  const initialState = {
    sqlLab: {
      ...sqlLabReducer(undefined, {}),
    },
    common: {
      conf: { SUPERSET_WEBSERVER_TIMEOUT: 45 },
    },
  };
  const store = mockStore(initialState);
  const mockedProps = {
    database,
    show: true,
    query: queries[0],
  };
  const mockColumns = {
    ds: {
      is_date: true,
      name: 'ds',
      type: 'STRING',
    },
    gender: {
      is_date: false,
      name: 'gender',
      type: 'STRING',
    },
  };
  const mockChartTypeBarChart = {
    label: 'Distribution - Bar Chart',
    value: 'dist_bar',
  };
  const mockChartTypeTB = {
    label: 'Time Series - Bar Chart',
    value: 'bar',
  };
  const getExploreResultsButtonWrapper = (props = mockedProps) =>
    shallow(<ExploreResultsButton store={store} {...props} />)
      .dive()
      .dive();

  it('renders', () => {
    expect(React.isValidElement(<ExploreResultsButton />)).toBe(true);
  });

  it('renders with props', () => {
    expect(
      React.isValidElement(<ExploreResultsButton {...mockedProps} />),
    ).toBe(true);
  });

  it('detects bad columns', () => {
    const wrapper = getExploreResultsButtonWrapper({
      database,
      show: true,
      query: queryWithBadColumns,
    });

    const badCols = wrapper.instance().getInvalidColumns();
    expect(badCols).toEqual(['my_dupe_col__2', '__timestamp', '__TIMESTAMP']);

    const msgWrapper = shallow(wrapper.instance().renderInvalidColumnMessage());
    expect(msgWrapper.find('div')).toHaveLength(1);
  });

  it('renders a Button', () => {
    const wrapper = getExploreResultsButtonWrapper();
    expect(wrapper.find(Button)).toExist();
  });

  describe('datasourceName', () => {
    let wrapper;
    let stub;
    beforeEach(() => {
      wrapper = getExploreResultsButtonWrapper();
      stub = sinon.stub(shortid, 'generate').returns('abcd');
    });
    afterEach(() => {
      stub.restore();
    });

    it('should generate data source name from query', () => {
      const sampleQuery = queries[0];
      const name = wrapper.instance().datasourceName();
      expect(name).toBe(`${sampleQuery.user}-${sampleQuery.tab}-abcd`);
    });
    it('should generate data source name with empty query', () => {
      wrapper.setProps({ query: {} });
      const name = wrapper.instance().datasourceName();
      expect(name).toBe('undefined-abcd');
    });

    it('should build viz options', () => {
      wrapper.setState({ chartType: mockChartTypeTB });
      const spy = sinon.spy(wrapper.instance(), 'buildVizOptions');
      wrapper.instance().buildVizOptions();
      expect(spy.returnValues[0]).toEqual({
        schema: 'test_schema',
        sql: wrapper.instance().props.query.sql,
        dbId: wrapper.instance().props.query.dbId,
        columns: Object.values(mockColumns),
        templateParams: undefined,
        datasourceName: 'admin-Demo-abcd',
      });
    });
  });

  it('should build visualize advise for long query', () => {
    const longQuery = { ...queries[0], endDttm: 1476910666798 };
    const props = {
      show: true,
      query: longQuery,
      database,
    };
    const longQueryWrapper = shallow(
      <ExploreResultsButton store={store} {...props} />,
    )
      .dive()
      .dive();
    const inst = longQueryWrapper.instance();
    expect(inst.getQueryDuration()).toBe(100.7050400390625);
  });

  describe('visualize', () => {
    const wrapper = getExploreResultsButtonWrapper();
    const mockOptions = { attr: 'mockOptions' };
    wrapper.setState({
      chartType: mockChartTypeBarChart,
      datasourceName: 'mockDatasourceName',
    });

    const visualizeURL = '/superset/sqllab_viz/';
    const visualizeEndpoint = `glob:*${visualizeURL}`;
    const visualizationPayload = { table_id: 107 };
    fetchMock.post(visualizeEndpoint, visualizationPayload);

    beforeEach(() => {
      sinon.stub(exploreUtils, 'getExploreUrl').callsFake(() => 'mockURL');
      sinon.spy(exploreUtils, 'exportChart');
      sinon.spy(exploreUtils, 'exploreChart');
      sinon
        .stub(wrapper.instance(), 'buildVizOptions')
        .callsFake(() => mockOptions);
    });
    afterEach(() => {
      exploreUtils.getExploreUrl.restore();
      exploreUtils.exploreChart.restore();
      exploreUtils.exportChart.restore();
      wrapper.instance().buildVizOptions.restore();
      fetchMock.reset();
    });
  });
});
