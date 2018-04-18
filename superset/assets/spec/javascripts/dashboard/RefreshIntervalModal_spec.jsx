import React from 'react';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import RefreshIntervalModal from '../../../src/dashboard/components/RefreshIntervalModal';

describe('RefreshIntervalModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<RefreshIntervalModal {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<RefreshIntervalModal {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).to.have.length(1);
  });
});
