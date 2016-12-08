import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { fields } from '../../../../javascripts/explorev2/stores/fields';
import { defaultFormData } from '../../../../javascripts/explorev2/stores/store';
import FieldSetRow from '../../../../javascripts/explorev2/components/FieldSetRow';
import FieldSet from '../../../../javascripts/explorev2/components/FieldSet';

const defaultProps = {
  fields,
  fieldSets: ['columns', 'metrics'],
  form_data: defaultFormData(),
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
    const length = defaultProps.fieldSets.length;
    expect(wrapper.find(FieldSet)).to.have.lengthOf(length);
  });
});
