import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import InfoTooltipWithTrigger from '../../../javascripts/components/InfoTooltipWithTrigger';
import OptionDescription from '../../../javascripts/components/OptionDescription';

const defaultProps = {
  option: {
    label: 'Some option',
    description: 'Description for some option',
  },
};

describe('OptionDescription', () => {
  let wrapper;
  let props;

  beforeEach(() => {
    props = { option: Object.assign({}, defaultProps.option) };
    wrapper = shallow(<OptionDescription {...props} />);
  });

  it('renders an InfoTooltipWithTrigger', () => {
    expect(wrapper.find(InfoTooltipWithTrigger)).to.have.lengthOf(1);
  });

  it('renders a span with the label', () => {
    expect(wrapper.find('.option-label').text()).to.equal('Some option');
  });
});
