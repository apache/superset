/* eslint-disable no-unused-expressions */
import React from 'react';
import { mount } from 'enzyme';
import { Creatable } from 'react-select';
import { getCategoricalSchemeRegistry } from '@superset-ui/color';

import ColorSchemeControl from
  '../../../../src/explore/components/controls/ColorSchemeControl';

const defaultProps = {
  options: getCategoricalSchemeRegistry().keys().map(s => ([s, s])),
};

describe('ColorSchemeControl', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = mount(<ColorSchemeControl {...defaultProps} />);
  });

  it('renders a Creatable', () => {
    expect(wrapper.find(Creatable)).toHaveLength(1);
  });
});
