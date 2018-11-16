import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { shallow } from 'enzyme';
import sinon from 'sinon';

import App from 'src/SqlLab/components/App';
import TabbedSqlEditors from 'src/SqlLab/components/TabbedSqlEditors';
import sqlLabReducer from 'src/SqlLab/reducers/index';

describe('SqlLab App', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore(sqlLabReducer(undefined, {}), {});
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<App />, { context: { store } });
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
