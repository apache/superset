/* eslint-disable no-unused-expressions */
import React from 'react';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { mount } from 'enzyme';
import { Creatable } from 'react-select';

import ColorSchemeControl from
  '../../../../src/explore/components/controls/ColorSchemeControl';
import { ALL_COLOR_SCHEMES } from '../../../../src/modules/colors';

const defaultProps = {
  options: Object.keys(ALL_COLOR_SCHEMES).map(s => ([s, s])),
};

describe('ColorSchemeControl', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = mount(<ColorSchemeControl {...defaultProps} />);
  });

  it('renders a Creatable', () => {
    expect(wrapper.find(Creatable)).to.have.length(1);
  });
});
