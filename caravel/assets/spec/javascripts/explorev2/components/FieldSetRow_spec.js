import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';

import FieldSetRow from '../../../../javascripts/explorev2/components/FieldSetRow';

const defaultProps = {
  fieldSets: ['columns', 'metrics'],
};

describe('FieldSetRow', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<FieldSetRow {...defaultProps} />);
  });

  it('renders a single <ul>', () => {
    expect(wrapper.find('ul')).to.have.lengthOf(1);
  });

  it('renders a <li> for each item in fieldSets array', () => {
    const length = defaultProps.fieldSets.length;
    expect(wrapper.find('li')).to.have.lengthOf(length);
  });
});
