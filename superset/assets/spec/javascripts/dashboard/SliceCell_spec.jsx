import React from 'react';
import SliceCell from '../../../javascripts/dashboard/components/SliceCell';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { slice } from './fixtures';


describe('SliceCell', () => {
  const mockedProps = {
    slice,
    removeSlice: () => {},
    expandedSlices: () => {},
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<SliceCell {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders five links', () => {
    const wrapper = mount(<SliceCell {...mockedProps} />);
    expect(wrapper.find('a')).to.have.length(5);
  });
});
