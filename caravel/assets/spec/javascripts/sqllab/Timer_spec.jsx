import React from 'react';
import Timer from '../../../javascripts/SqlLab/components/Timer';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { queries } from './common';


describe('Timer', () => {
  const mockedProps = {
    query: queries[0],
  };
  it('should just render', () => {
    expect(React.isValidElement(<Timer />)).to.equal(true);
  });
  it('should render with props', () => {
    expect(React.isValidElement(<Timer {...mockedProps} />))
    .to.equal(true);
  });
  it('has a span', () => {
    const wrapper = shallow(<Timer {...mockedProps} />);
    expect(wrapper.find('span')).to.have.length(1);
  });
});
