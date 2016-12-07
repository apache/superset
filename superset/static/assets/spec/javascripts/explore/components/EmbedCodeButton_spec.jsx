import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { shallow, mount } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';

import EmbedCodeButton from '../../../../javascripts/explore/components/EmbedCodeButton';

describe('EmbedCodeButton', () => {
  const defaultProps = {
    slice: {
      data: {
        standalone_endpoint: 'endpoint_url',
      },
    },
  };

  it('renders', () => {
    expect(React.isValidElement(<EmbedCodeButton {...defaultProps} />)).to.equal(true);
  });

  it('renders overlay trigger', () => {
    const wrapper = shallow(<EmbedCodeButton {...defaultProps} />);
    expect(wrapper.find(OverlayTrigger)).to.have.length(1);
  });

  it('returns correct embed code', () => {
    const wrapper = mount(<EmbedCodeButton {...defaultProps} />);
    wrapper.setState({
      height: '1000',
      width: '2000',
      srcLink: 'http://localhost/endpoint_url',
    });
    const embedHTML = `
      <iframe
        src="nullendpoint_url"
        width="2000"
        height="1000"
        seamless frameBorder="0" scrolling="no">
      </iframe>`;
    expect(wrapper.instance().generateEmbedHTML()).to.equal(embedHTML);
  });
});
