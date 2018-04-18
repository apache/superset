/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import AggregateOption from '../../../../src/explore/components/AggregateOption';

describe('AggregateOption', () => {
  it('renders the aggregate', () => {
    const wrapper = shallow(<AggregateOption aggregate={{ aggregate_name: 'SUM' }} />);
    expect(wrapper.text()).to.equal('SUM');
  });
});
