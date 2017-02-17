import React from 'react';
import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import QueryAndSaveButtons from '../../../../javascripts/explorev2/components/QueryAndSaveBtns';
import Button from '../../../../javascripts/components/Button';

describe('QueryAndSaveButtons', () => {
  const defaultProps = {
    canAdd: 'True',
    onQuery: sinon.spy(),
  };

  // It must render
  it('renders', () => {
    expect(React.isValidElement(<QueryAndSaveButtons {...defaultProps} />)).to.equal(true);
  });

  // Test the output
  describe('output', () => {
    let wrapper;

    beforeEach(() => {
      wrapper = shallow(<QueryAndSaveButtons {...defaultProps} />);
    });

    it('renders 2 buttons', () => {
      expect(wrapper.find(Button)).to.have.lengthOf(2);
    });

    it('renders buttons with correct text', () => {
      expect(wrapper.find(Button).contains(' Query')).to.eql(true);
      expect(wrapper.find(Button).contains(' Save as')).to.eql(true);
    });

    it('calls onQuery when query button is clicked', () => {
      const queryButton = wrapper.find('.query');
      queryButton.simulate('click');
      expect(defaultProps.onQuery.called).to.eql(true);
    });
  });
});
