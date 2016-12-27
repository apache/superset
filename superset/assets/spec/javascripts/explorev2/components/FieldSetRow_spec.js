import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import FieldSetRow from '../../../../javascripts/explorev2/components/FieldSetRow';

const defaultProps = {
  fields: [<a />, <a />],
};

describe('FieldSetRow', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<FieldSetRow {...defaultProps} />);
  });

  it('renders a single row element', () => {
    expect(wrapper.find('.row')).to.have.lengthOf(1);
  });

  it('renders a FieldSet for each item in fieldSets array', () => {
    expect(wrapper.find('a')).to.have.lengthOf(2);
  });
});
