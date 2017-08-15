import React from 'react';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { slice } from './fixtures';

import SliceCell from '../../../javascripts/dashboard/components/SliceCell';

describe('SliceCell', () => {
  const mockedProps = {
    slice,
    removeSlice: () => {},
    expandedSlices: {},
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<SliceCell {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders six links', () => {
    const wrapper = mount(<SliceCell {...mockedProps} />);
    expect(wrapper.find('a')).to.have.length(6);
  });
});
