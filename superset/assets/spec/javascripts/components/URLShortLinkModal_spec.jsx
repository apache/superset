import React from 'react';
import configureStore from 'redux-mock-store';
import { shallow } from 'enzyme';

import URLShortLinkModal from '../../../src/components/URLShortLinkModal';
import ModalTrigger from '../../../src/components/ModalTrigger';

describe('URLShortLinkModal', () => {
  const defaultProps = {
    url: 'mockURL',
    emailSubject: 'Mock Subject',
    emailContent: 'mock content',
  };

  function setup() {
    const mockStore = configureStore([]);
    const store = mockStore({});
    return shallow(<URLShortLinkModal {...defaultProps} />, { context: { store } }).dive();
  }

  it('renders ModalTrigger', () => {
    const wrapper = setup();
    expect(wrapper.find(ModalTrigger)).toHaveLength(1);
  });
});
