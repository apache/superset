import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import InfoTooltipWithTrigger from '../../../javascripts/components/InfoTooltipWithTrigger';
import NullOption from '../../../javascripts/components/NullOption';

describe('NullOption', () => {
  const defaultProps = {
    option: {
      value: 'foo',
      label: 'foo',
    },
  };

  let wrapper;
  const factory = o => <NullOption {...o} />;
  beforeEach(() => {
    wrapper = shallow(factory(defaultProps));
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<NullOption {...defaultProps} />)).to.equal(true);
  });
  it('renders label', () => {
    expect(wrapper.find('span').text()).to.equal(defaultProps.option.label);
  });
  it('renders null label with tooltip', () => {
    wrapper = shallow(factory({ option: { value: null, label: null } }));
    expect(wrapper.find(InfoTooltipWithTrigger)).to.have.length(1);
    expect(wrapper.find('.option-label').text()).to.equal('NULL');
  });
});
