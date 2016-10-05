import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';
import { Button } from 'react-bootstrap';
import Select from 'react-select';
import { Filters } from '../../../../javascripts/explorev2/components/Filters';
import shortid from 'shortid';

function setup() {
  const props = {
    filters: [
      {
        id: shortid.generate(),
        field: null,
        op: null,
        value: null,
      },
    ]
  }
  const wrapper = shallow(<Filters {...props} />);
  return {
    props,
    wrapper,
  };
}

describe('Filters', () => {
  it('renders', () => {
    expect(React.isValidElement(<Filters />)).to.equal(true);
  });

  it('should have one button', () => {
    const wrapper = shallow(<Filters />);
    expect(wrapper.find(Button)).to.have.length(1);
    expect(wrapper.find(Button).contains('Add Filter')).to.eql(true);
  });

  it('should have Select and button for filters', () => {
    const { wrapper, props } = setup();
    expect(wrapper.find(Button)).to.have.length(2);
    expect(wrapper.find(Select)).to.have.length(2);
    expect(wrapper.find('input')).to.have.length(1);
  });
});
