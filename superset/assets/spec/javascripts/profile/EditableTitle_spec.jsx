import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';
import { expect } from 'chai';

import EditableTable from '../../../src/components/EditableTitle';

describe('EditableTitle', () => {
  const callback = sinon.spy();
  const mockProps = {
    title: 'my title',
    canEdit: true,
    onSaveTitle: callback,
  };
  const mockEvent = {
    target: {
      value: 'new title',
    },
  };
  const editableWrapper = shallow(<EditableTable {...mockProps} />);
  const notEditableWrapper = shallow(<EditableTable title="my title" onSaveTitle={callback} />);
  it('is valid', () => {
    expect(
      React.isValidElement(<EditableTable {...mockProps} />),
    ).to.equal(true);
  });
  it('should render title', () => {
    const titleElement = editableWrapper.find('input');
    expect(titleElement.props().value).to.equal('my title');
    expect(titleElement.props().type).to.equal('button');
  });

  describe('should handle click', () => {
    it('should change title', () => {
      editableWrapper.find('input').simulate('click');
      expect(editableWrapper.find('input').props().type).to.equal('text');
    });
    it('should not change title', () => {
      notEditableWrapper.find('input').simulate('click');
      expect(notEditableWrapper.find('input').props().type).to.equal('button');
    });
  });

  describe('should handle change', () => {
    afterEach(() => {
      editableWrapper.setState({ title: 'my title' });
      editableWrapper.setState({ lastTitle: 'my title' });
    });
    it('should change title', () => {
      editableWrapper.find('input').simulate('change', mockEvent);
      expect(editableWrapper.find('input').props().value).to.equal('new title');
    });
    it('should not change title', () => {
      notEditableWrapper.find('input').simulate('change', mockEvent);
      expect(editableWrapper.find('input').props().value).to.equal('my title');
    });
  });

  describe('should handle blur', () => {
    beforeEach(() => {
      editableWrapper.find('input').simulate('click');
      expect(editableWrapper.find('input').props().type).to.equal('text');
    });
    afterEach(() => {
      callback.reset();
      editableWrapper.setState({ title: 'my title' });
      editableWrapper.setState({ lastTitle: 'my title' });
    });

    it('should trigger callback', () => {
      editableWrapper.setState({ title: 'new title' });
      editableWrapper.find('input').simulate('blur');
      expect(editableWrapper.find('input').props().type).to.equal('button');
      expect(callback.callCount).to.equal(1);
      expect(callback.getCall(0).args[0]).to.equal('new title');
    });
    it('should not trigger callback', () => {
      editableWrapper.find('input').simulate('blur');
      expect(editableWrapper.find('input').props().type).to.equal('button');
      // no change
      expect(callback.callCount).to.equal(0);
    });
    it('should not save empty title', () => {
      editableWrapper.setState({ title: '' });
      editableWrapper.find('input').simulate('blur');
      expect(editableWrapper.find('input').props().type).to.equal('button');
      expect(editableWrapper.find('input').props().value).to.equal('my title');
      expect(callback.callCount).to.equal(0);
    });
  });
});
