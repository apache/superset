import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { shallow } from 'enzyme';
import sinon from 'sinon';

import App from '../../../src/SqlLab/components/App';
import TabbedSqlEditors from '../../../src/SqlLab/components/TabbedSqlEditors';
import getInitialState from '../../../src/SqlLab/getInitialState';

describe('SqlLab App', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  let store;
  let wrapper;

  beforeAll(() => {
    const bootstrapData = {
      common: {
        feature_flags: {
          FOO_BAR: true,
        },
      },
    };
    store = mockStore(getInitialState(bootstrapData), {});
  });

  beforeEach(() => {
    wrapper = shallow(<App />, { context: { store } });
  });

  it('should set feature flags', () => {
    expect(wrapper.prop('isFeatureEnabled')('FOO_BAR')).toBe(true);
  });

  it('is valid', () => {
    expect(React.isValidElement(<App />)).toBe(true);
  });

  it('should handler resize', () => {
    const inner = wrapper.dive();
    sinon.spy(inner.instance(), 'getHeight');
    inner.instance().handleResize();
    expect(inner.instance().getHeight.callCount).toBe(1);
    inner.instance().getHeight.restore();
  });

  it('should render', () => {
    const inner = wrapper.dive();
    expect(inner.find('.SqlLab')).toHaveLength(1);
    expect(inner.find(TabbedSqlEditors)).toHaveLength(1);
  });
});
