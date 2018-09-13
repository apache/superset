import React from 'react';
import { expect } from 'chai';

import ModalTrigger from '../../../src/components/ModalTrigger';

describe('ModalTrigger', () => {
  const defaultProps = {
    triggerNode: <i className="fa fa-link" />,
    modalTitle: 'My Modal Title',
    modalBody: <div>Modal Body</div>,
  };

  it('is a valid element', () => {
    expect(
      React.isValidElement(<ModalTrigger {...defaultProps} />),
    ).to.equal(true);
  });
});
