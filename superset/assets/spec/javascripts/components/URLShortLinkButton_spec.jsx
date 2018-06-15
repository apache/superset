import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow } from 'enzyme';

import { OverlayTrigger } from 'react-bootstrap';
import URLShortLinkButton from '../../../src/components/URLShortLinkButton';

describe('URLShortLinkButton', () => {
  const defaultProps = {
    url: 'mockURL',
    emailSubject: 'Mock Subject',
    emailContent: 'mock content',
  };

  it('renders', () => {
    expect(React.isValidElement(<URLShortLinkButton {...defaultProps} />)).to.equal(true);
  });
  it('renders OverlayTrigger', () => {
    const wrapper = shallow(<URLShortLinkButton {...defaultProps} />);
    expect(wrapper.find(OverlayTrigger)).have.length(1);
  });
});
