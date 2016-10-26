import React from 'react';
import { TabbedSqlEditors } from '../../../javascripts/SqlLab/components/TabbedSqlEditors';
import { Tab } from 'react-bootstrap';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { initialState } from './fixtures';

describe('TabbedSqlEditors', () => {
  const mockedProps = {
    actions: {},
    databases: {},
    tables: [],
    queries: {},
    queryEditors: initialState.queryEditors,
    tabHistory: initialState.tabHistory,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<TabbedSqlEditors {...mockedProps} />)
    ).to.equal(true);
  });
  it('shallow mounts', () => {
    const wrapper = shallow(<TabbedSqlEditors {...mockedProps} />);
    expect(wrapper.find(Tab)).to.have.length(2);
  });
});
