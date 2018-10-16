import React from 'react';
import { mount } from 'enzyme';
import ModalTrigger from './../../../../src/components/ModalTrigger';

import DisplayQueryButton from '../../../../src/explore/components/DisplayQueryButton';

describe('DisplayQueryButton', () => {
  const defaultProps = {
    animation: false,
    queryResponse: {
      query: 'SELECT * FROM foo',
      language: 'sql',
    },
    chartStatus: 'success',
    queryEndpoint: 'localhost',
    latestQueryFormData: {
      datasource: '1__table',
    },
  };

  it('is valid', () => {
    expect(React.isValidElement(<DisplayQueryButton {...defaultProps} />)).toBe(true);
  });
  it('renders a dropdown', () => {
    const wrapper = mount(<DisplayQueryButton {...defaultProps} />);
    expect(wrapper.find(ModalTrigger)).toHaveLength(3);
  });
});
