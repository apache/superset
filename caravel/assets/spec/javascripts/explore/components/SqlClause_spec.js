import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { SqlClause } from '../../../../javascripts/explorev2/components/SqlClause';

describe('SqlClause', () => {
  it('renders', () => {
    expect(React.isValidElement(<SqlClause />)).to.equal(true);
  });

  it('should have two input fields', () => {
    const wrapper = shallow(<SqlClause />);
    expect(wrapper.find('input')).to.have.length(2);
  });
});
