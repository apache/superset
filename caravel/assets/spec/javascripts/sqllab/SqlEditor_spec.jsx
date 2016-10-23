import React from 'react';
import SqlEditor from '../../../javascripts/SqlLab/components/SqlEditor';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { initialState, queries, tables } from './common';

describe('SqlEditor', () => {
  const mockedProps = {
    actions: {},
    database: {},
    queryEditor: initialState.queryEditors[0],
    latestQuery: queries[0],
    tables,
  };
  it('should be valid', () => {
    expect(React.isValidElement(<SqlEditor />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<SqlEditor {...mockedProps} />)
    ).to.equal(true);
  });
  it('shallow mounts', () => {
    shallow(<SqlEditor {...mockedProps} />);
  });
});
