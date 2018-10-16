import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import QueryAndSaveButtons from '../../../../src/explore/components/QueryAndSaveBtns';
import Button from '../../../../src/components/Button';

describe('QueryAndSaveButtons', () => {
  const defaultProps = {
    canAdd: 'True',
    onQuery: sinon.spy(),
  };

  // It must render
  it('renders', () => {
    expect(React.isValidElement(<QueryAndSaveButtons {...defaultProps} />)).toBe(true);
  });

  // Test the output
  describe('output', () => {
    let wrapper;

    beforeEach(() => {
      wrapper = shallow(<QueryAndSaveButtons {...defaultProps} />);
    });

    it('renders 2 buttons', () => {
      expect(wrapper.find(Button)).toHaveLength(2);
    });

    it('renders buttons with correct text', () => {
      expect(wrapper.find(Button).contains(' Run Query')).toBe(true);
      expect(wrapper.find(Button).contains(' Save')).toBe(true);
    });

    it('calls onQuery when query button is clicked', () => {
      const queryButton = wrapper.find('.query');
      queryButton.simulate('click');
      expect(defaultProps.onQuery.called).toBe(true);
    });
  });
});
