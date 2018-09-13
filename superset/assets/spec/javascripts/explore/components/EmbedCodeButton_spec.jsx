import React from 'react';
import { expect } from 'chai';
import { shallow, mount } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';
import sinon from 'sinon';

import EmbedCodeButton from '../../../../src/explore/components/EmbedCodeButton';
import * as exploreUtils from '../../../../src/explore/exploreUtils';

describe('EmbedCodeButton', () => {
  const defaultProps = {
    latestQueryFormData: { datasource: '107__table' },
  };

  it('renders', () => {
    expect(React.isValidElement(<EmbedCodeButton {...defaultProps} />)).to.equal(true);
  });

  it('renders overlay trigger', () => {
    const wrapper = shallow(<EmbedCodeButton {...defaultProps} />);
    expect(wrapper.find(OverlayTrigger)).to.have.length(1);
  });

  it('returns correct embed code', () => {
    const stub = sinon.stub(exploreUtils, 'getExploreLongUrl').callsFake(() => ('endpoint_url'));
    const wrapper = mount(<EmbedCodeButton {...defaultProps} />);
    wrapper.setState({
      height: '1000',
      width: '2000',
    });
    const embedHTML = (
      '<iframe\n' +
      '  width="2000"\n' +
      '  height="1000"\n' +
      '  seamless\n' +
      '  frameBorder="0"\n' +
      '  scrolling="no"\n' +
      '  src="nullendpoint_url&height=1000"\n' +
      '>\n' +
      '</iframe>'
    );
    expect(wrapper.instance().generateEmbedHTML()).to.equal(embedHTML);
    stub.restore();
  });
});
