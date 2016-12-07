import React from 'react';
import { beforeEach, describe, it } from 'mocha';
import { expect } from 'chai';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import QueryAndSaveButtons from '../../../../javascripts/explore/components/QueryAndSaveBtns';

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
      expect(wrapper.find('button')).to.have.lengthOf(2);
    });

    it('renders buttons with correct text', () => {
      expect(wrapper.find('button').contains(' Query')).to.eql(true);
      expect(wrapper.find('button').contains(' Save as')).to.eql(true);
    });

    it('calls onQuery when query button is clicked', () => {
      const queryButton = wrapper.find('#query_button');
      queryButton.simulate('click');
      expect(defaultProps.onQuery.called).to.eql(true);
    });
  });
});
