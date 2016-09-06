import React from 'react';
import { expect } from 'chai';
import { describe, it } from 'mocha';

import ModalTrigger from '../../../javascripts/components/ModalTrigger';

describe('ModalTrigger', () => {
  const defaultProps = {
    buttonBody: <button>My Button</button>,
    modalTitle: 'My Modal Title',
    modalBody: <div>Modal Body</div>,
  };

  it('renders', () => {
    expect(
      React.isValidElement(<ModalTrigger {...defaultProps} />)
    ).to.equal(true);
  });
});
