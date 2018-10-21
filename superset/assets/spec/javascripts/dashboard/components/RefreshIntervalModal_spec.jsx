import React from 'react';
import { mount } from 'enzyme';

import RefreshIntervalModal from '../../../../src/dashboard/components/RefreshIntervalModal';

describe('RefreshIntervalModal', () => {
  const mockedProps = {
    triggerNode: <i className="fa fa-edit" />,
  };
  it('is valid', () => {
    expect(
      React.isValidElement(<RefreshIntervalModal {...mockedProps} />),
    ).toBe(true);
  });
  it('renders the trigger node', () => {
    const wrapper = mount(<RefreshIntervalModal {...mockedProps} />);
    expect(wrapper.find('.fa-edit')).toHaveLength(1);
  });
});
