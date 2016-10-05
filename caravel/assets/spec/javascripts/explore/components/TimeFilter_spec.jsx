import React from 'react';
import Select from 'react-select';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { TimeFilter } from '../../../../javascripts/explorev2/components/TimeFilter';

describe('TimeFilter', () => {
  it('renders', () => {
    expect(React.isValidElement(<TimeFilter />)).to.equal(true);
  });

  it('should have four Select', () => {
    const wrapper = shallow(<TimeFilter />);
    expect(wrapper.find(Select)).to.have.length(4);
  });
});
