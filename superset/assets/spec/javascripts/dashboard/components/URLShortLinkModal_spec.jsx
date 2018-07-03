import React from 'react';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import URLShortLinkModal from '../../../../src/dashboard/components/URLShortLinkModal';

describe('URLShortLinkModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<URLShortLinkModal {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<URLShortLinkModal {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).to.have.length(1);
  });
});
