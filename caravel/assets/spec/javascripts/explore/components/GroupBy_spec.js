import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import Select from 'react-select';
import { GroupBy } from '../../../../javascripts/explorev2/components/GroupBy';

describe('GroupBy', () => {
  it('renders', () => {
    expect(React.isValidElement(<GroupBy />)).to.equal(true);
  });

  it('should have two Select', () => {
    const wrapper = shallow(<GroupBy />);
    expect(wrapper.find(Select)).to.have.length(2);
  });
});
