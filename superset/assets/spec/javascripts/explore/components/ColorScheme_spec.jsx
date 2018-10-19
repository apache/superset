/* eslint-disable no-unused-expressions */
import React from 'react';
import { mount } from 'enzyme';
import { Creatable } from 'react-select';

import ColorSchemeControl from
  '../../../../src/explore/components/controls/ColorSchemeControl';
import getCategoricalSchemeRegistry from '../../../../src/modules/colors/CategoricalSchemeRegistrySingleton';

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
