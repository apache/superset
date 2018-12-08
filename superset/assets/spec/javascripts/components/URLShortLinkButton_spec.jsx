import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';

import { OverlayTrigger } from 'react-bootstrap';
import URLShortLinkButton from '../../../src/components/URLShortLinkButton';

describe('URLShortLinkButton', () => {
  const defaultProps = {
    url: 'mockURL',
    emailSubject: 'Mock Subject',
    emailContent: 'mock content',
  };

  function setup() {
    const mockStore = configureStore([]);
    const store = mockStore({});
    return shallow(<URLShortLinkButton {...defaultProps} />, { context: { store } }).dive();
  }

  it('renders OverlayTrigger', () => {
    const wrapper = setup();
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });
});
