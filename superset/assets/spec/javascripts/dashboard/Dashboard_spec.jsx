import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import * as dashboardActions from '../../../javascripts/dashboard/actions';
import * as chartActions from '../../../javascripts/chart/chartAction';
import Dashboard from '../../../javascripts/dashboard/components/Dashboard';
import { defaultFilters, dashboard, charts } from './fixtures';

describe('Dashboard', () => {
  const mockedProps = {
    actions: { ...chartActions, ...dashboardActions },
    initMessages: [],
    dashboard: dashboard.dashboard,
    slices: charts,
    filters: dashboard.filters,
    datasources: dashboard.datasources,
    refresh: false,
    timeout: 60,
    isStarred: false,
    userId: dashboard.userId,
  };

  it('should render', () => {
    const wrapper = shallow(<Dashboard {...mockedProps} />);
    expect(wrapper.find('#dashboard-container')).to.have.length(1);
    expect(wrapper.instance().getAllSlices()).to.have.length(2);
  });

  it('should handle metadata default_filters', () => {
    const wrapper = shallow(<Dashboard {...mockedProps} />);
    expect(wrapper.instance().props.filters).deep.equal(defaultFilters);
  });

  describe('getFormDataExtra', () => {
    let wrapper;
    let selectedSlice;
    beforeEach(() => {
      wrapper = shallow(<Dashboard {...mockedProps} />);
      selectedSlice = wrapper.instance().props.dashboard.slices[1];
    });

    it('should carry default_filters', () => {
      const extraFilters = wrapper.instance().getFormDataExtra(selectedSlice).extra_filters;
      expect(extraFilters[0]).to.deep.equal({ col: 'region', op: 'in', val: [] });
      expect(extraFilters[1]).to.deep.equal({ col: 'country_name', op: 'in', val: ['United States'] });
    });

    it('should carry updated filter', () => {
      wrapper.setProps({
        filters: {
          256: {
            region: [],
            country_name: ['France'],
          },
        },
      });
      const extraFilters = wrapper.instance().getFormDataExtra(selectedSlice).extra_filters;
      expect(extraFilters[1]).to.deep.equal({ col: 'country_name', op: 'in', val: ['France'] });
    });
  });

  describe('refreshExcept', () => {
    let wrapper;
    let spy;
    beforeEach(() => {
      wrapper = shallow(<Dashboard {...mockedProps} />);
      spy = sinon.spy(wrapper.instance(), 'fetchSlices');
    });
    afterEach(() => {
      spy.restore();
    });

    it('should not refresh filter slice', () => {
      const filterKey = Object.keys(defaultFilters)[0];
      wrapper.instance().refreshExcept(filterKey);
      expect(spy.callCount).to.equal(1);
      expect(spy.getCall(0).args[0].length).to.equal(1);
    });

    it('should refresh all slices', () => {
      wrapper.instance().refreshExcept();
      expect(spy.callCount).to.equal(1);
      expect(spy.getCall(0).args[0].length).to.equal(2);
    });
  });
});
