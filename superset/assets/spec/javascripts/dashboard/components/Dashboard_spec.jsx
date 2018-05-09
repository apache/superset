/* global beforeEach, afterEach */
/* eslint camelcase: 0 */
import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import * as sliceActions from '../../../../src/dashboard/actions/sliceEntities';
import * as dashboardActions from '../../../../src/dashboard/actions/dashboardState';
import * as chartActions from '../../../../src/chart/chartAction';
import Dashboard from '../../../../src/dashboard/components/Dashboard';
import {
  defaultFilters,
  dashboardState,
  dashboardInfo,
  dashboardLayout,
  charts,
  datasources,
  sliceEntities,
} from '../fixtures';

describe('Dashboard', () => {
  const mockedProps = {
    actions: { ...chartActions, ...dashboardActions, ...sliceActions },
    initMessages: [],
    dashboardState,
    dashboardInfo,
    charts,
    slices: sliceEntities.slices,
    datasources,
    layout: dashboardLayout.present,
    timeout: 60,
    userId: dashboardInfo.userId,
  };

  it('should render', () => {
    const wrapper = shallow(<Dashboard {...mockedProps} />);
    expect(wrapper.find('#dashboard-container')).to.have.length(1);
    expect(wrapper.instance().getAllCharts()).to.have.length(3);
  });

  it('should handle metadata default_filters', () => {
    const wrapper = shallow(<Dashboard {...mockedProps} />);
    expect(wrapper.instance().props.dashboardState.filters).deep.equal(
      defaultFilters,
    );
  });

  describe('getFormDataExtra', () => {
    let wrapper;
    let selectedChart;
    beforeEach(() => {
      wrapper = shallow(<Dashboard {...mockedProps} />);
      selectedChart = charts[248];
    });

    it('should carry default_filters', () => {
      const extraFilters = wrapper.instance().getFormDataExtra(selectedChart)
        .extra_filters;
      expect(extraFilters[0]).to.deep.equal({
        col: 'region',
        op: 'in',
        val: [],
      });
      expect(extraFilters[1]).to.deep.equal({
        col: 'country_name',
        op: 'in',
        val: ['United States'],
      });
    });

    it('should carry updated filter', () => {
      const newState = {
        ...wrapper.props('dashboardState'),
        filters: {
          256: { region: [] },
          257: { country_name: ['France'] },
        },
      };
      wrapper.setProps({
        dashboardState: newState,
      });
      const extraFilters = wrapper.instance().getFormDataExtra(selectedChart)
        .extra_filters;
      expect(extraFilters[1]).to.deep.equal({
        col: 'country_name',
        op: 'in',
        val: ['France'],
      });
    });
  });

  describe('refreshExcept', () => {
    let wrapper;
    let spy;
    beforeEach(() => {
      wrapper = shallow(<Dashboard {...mockedProps} />);
      spy = sinon.spy(mockedProps.actions, 'runQuery');
    });
    afterEach(() => {
      spy.restore();
    });

    it('should not refresh filter slice', () => {
      const filterKey = Object.keys(defaultFilters)[1];
      wrapper.instance().refreshExcept(filterKey);
      expect(spy.callCount).to.equal(1);
      const slice_id = spy.getCall(0).args[0].slice_id;
      expect(slice_id).to.equal(248);
    });

    it('should refresh all slices', () => {
      wrapper.instance().refreshExcept();
      expect(spy.callCount).to.equal(3);
    });
  });

  describe('componentDidUpdate', () => {
    let wrapper;
    let refreshExceptSpy;
    let fetchSlicesStub;
    let prevProp;
    beforeEach(() => {
      wrapper = shallow(<Dashboard {...mockedProps} />);
      prevProp = wrapper.instance().props;
      refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      fetchSlicesStub = sinon.stub(mockedProps.actions, 'fetchCharts');
    });
    afterEach(() => {
      fetchSlicesStub.restore();
      refreshExceptSpy.restore();
    });

    describe('should check if filter has change', () => {
      beforeEach(() => {
        refreshExceptSpy.reset();
      });
      it('no change', () => {
        const newState = {
          ...wrapper.props('dashboardState'),
          filters: {
            256: { region: [] },
            257: { country_name: ['United States'] },
          },
        };
        wrapper.setProps({
          dashboardState: newState,
        });
        wrapper.instance().componentDidUpdate(prevProp);
        expect(refreshExceptSpy.callCount).to.equal(0);
      });

      it('remove filter', () => {
        const newState = {
          ...wrapper.props('dashboardState'),
          refresh: true,
          filters: {
            256: { region: [] },
          },
        };
        wrapper.setProps({
          dashboardState: newState,
        });
        wrapper.instance().componentDidUpdate(prevProp);
        expect(refreshExceptSpy.callCount).to.equal(1);
      });

      it('change filter', () => {
        const newState = {
          ...wrapper.props('dashboardState'),
          refresh: true,
          filters: {
            256: { region: [] },
            257: { country_name: ['Canada'] },
          },
        };
        wrapper.setProps({
          dashboardState: newState,
        });
        wrapper.instance().componentDidUpdate(prevProp);
        expect(refreshExceptSpy.callCount).to.equal(1);
      });

      it('add filter', () => {
        const newState = {
          ...wrapper.props('dashboardState'),
          refresh: true,
          filters: {
            256: { region: [] },
            257: { country_name: ['Canada'] },
            258: { another_filter: ['new'] },
          },
        };
        wrapper.setProps({
          dashboardState: newState,
        });
        wrapper.instance().componentDidUpdate(prevProp);
        expect(refreshExceptSpy.callCount).to.equal(1);
      });
    });

    it('should refresh if refresh flag is true', () => {
      const newState = {
        ...wrapper.props('dashboardState'),
        refresh: true,
        filters: {
          256: { region: ['Asian'] },
        },
      };
      wrapper.setProps({
        dashboardState: newState,
      });
      wrapper.instance().componentDidUpdate(prevProp);
      expect(refreshExceptSpy.callCount).to.equal(1);
      expect(refreshExceptSpy.lastCall.args[0]).to.equal('256');
    });

    it('should not refresh filter_immune_slices', () => {
      const newState = {
        ...wrapper.props('dashboardState'),
        refresh: true,
        filters: {
          256: { region: [] },
          257: { country_name: ['Canada'] },
        },
      };
      wrapper.setProps({
        dashboardState: newState,
      });
      wrapper.instance().componentDidUpdate(prevProp);
      expect(refreshExceptSpy.callCount).to.equal(1);
      expect(refreshExceptSpy.lastCall.args[0]).to.equal('257');
    });
  });
});
