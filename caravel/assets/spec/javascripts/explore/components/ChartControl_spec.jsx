import React from 'react';
import Select from 'react-select';
import { ChartControl } from '../../../../javascripts/explorev2/components/ChartControl';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

describe('QuerySearch', () => {
  it('should render', () => {
    expect(
      React.isValidElement(<ChartControl />)
    ).to.equal(true);
  });

  const wrapper = shallow(<ChartControl />);
  it('should have two Select', () => {
    expect(wrapper.find(Select)).to.have.length(2);
  });
});

