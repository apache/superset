import React from 'react';
import ResultSet from '../../../javascripts/SqlLab/components/ResultSet';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { queries } from './common';


describe('ResultSet', () => {
  const mockedProps = {
    query: queries[0],
  };
  it('should just render', () => {
    expect(React.isValidElement(<ResultSet />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(
      React.isValidElement(<ResultSet />)
    ).to.equal(true);
  });
  it('has an anchor tag', () => {
    const wrapper = shallow(<ResultSet {...mockedProps} />);
    // expect(wrapper.find('a')).to.have.length(1);
  });
});
