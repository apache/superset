import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import FilterableTable from '../../../javascripts/components/FilterableTable/FilterableTable';
import ResultSet from '../../../javascripts/SqlLab/components/ResultSet';
import { queries } from './fixtures';

describe('ResultSet', () => {
  const mockedProps = {
    query: queries[0],
  };
  it('renders', () => {
    expect(React.isValidElement(<ResultSet />)).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<ResultSet />),
    ).to.equal(true);
  });
  it('renders a Table', () => {
    const wrapper = shallow(<ResultSet {...mockedProps} />);
    expect(wrapper.find(FilterableTable)).to.have.length(1);
  });
});
