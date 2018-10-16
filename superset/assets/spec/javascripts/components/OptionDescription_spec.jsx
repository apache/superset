import React from 'react';
import { shallow } from 'enzyme';

import InfoTooltipWithTrigger from '../../../src/components/InfoTooltipWithTrigger';
import OptionDescription from '../../../src/components/OptionDescription';

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
    expect(wrapper.find(InfoTooltipWithTrigger)).toHaveLength(1);
  });

  it('renders a span with the label', () => {
    expect(wrapper.find('.option-label').text()).toBe('Some option');
  });
});
