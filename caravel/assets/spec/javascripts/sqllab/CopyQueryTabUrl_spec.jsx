import React from 'react';
import CopyQueryTabUrl from '../../../javascripts/SqlLab/components/CopyQueryTabUrl';
import CopyToClipboard from '../../../javascripts/components/CopyToClipboard';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import { initialState } from './fixtures';

describe('CopyQueryTabUrl', () => {
  const mockedProps = {
    queryEditor: initialState.queryEditors[0],
  };
  it('should be valid', () => {
    expect(React.isValidElement(<CopyQueryTabUrl />)).to.equal(true);
  });
  it('renders with props', () => {
    expect(
      React.isValidElement(<CopyQueryTabUrl {...mockedProps} />)
    ).to.equal(true);
  });
  it('renders a CopyToClipboard', () => {
    const wrapper = shallow(<CopyQueryTabUrl {...mockedProps} />);
    expect(wrapper.find(CopyToClipboard)).to.have.length(1);
  });
});
