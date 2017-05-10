import React from 'react';
import { expect } from 'chai';
import { shallow } from 'enzyme';

import CopyToClipboard from '../../../../javascripts/components/CopyToClipboard';

describe('CopyToClipboard', () => {
  let defaultProps = {
    text: 'Some text to copy',
  };

  // It must render
  it('renders', () => {
    expect(React.isValidElement(<CopyToClipboard {...defaultProps} />)).to.equal(true);
  });

  // Test the output
  describe('output', () => {
    let wrapper;

    beforeEach(() => {
      wrapper = shallow(<CopyToClipboard {...defaultProps} />);
    });

    it('renders button with default text', () => {
      expect(wrapper.find('a').contains('Copy')).to.eql(true);
    });
  });
});
