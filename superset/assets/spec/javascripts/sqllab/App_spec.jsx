import React from 'react';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';

import { shallow } from 'enzyme';
import { expect } from 'chai';
import sinon from 'sinon';

import App from '../../../src/SqlLab/components/App';
import TabbedSqlEditors from '../../../src/SqlLab/components/TabbedSqlEditors';
import { sqlLabReducer } from '../../../src/SqlLab/reducers';

describe('App', () => {
  const middlewares = [thunk];
  const mockStore = configureStore(middlewares);
  const store = mockStore({ sqlLab: sqlLabReducer(undefined, {}), messageToasts: [] });

  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<App />, { context: { store } }).dive();
  });

  it('is valid', () => {
    expect(React.isValidElement(<App />)).to.equal(true);
  });

  it('should handler resize', () => {
    sinon.spy(wrapper.instance(), 'getHeight');
    wrapper.instance().handleResize();
    expect(wrapper.instance().getHeight.callCount).to.equal(1);
    wrapper.instance().getHeight.restore();
  });

  it('should render', () => {
    expect(wrapper.find('.SqlLab')).to.have.length(1);
    expect(wrapper.find(TabbedSqlEditors)).to.have.length(1);
  });
});
