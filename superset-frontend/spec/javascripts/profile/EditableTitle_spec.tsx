/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { shallow } from 'enzyme';
import sinon from 'sinon';

import EditableTable from 'src/components/EditableTitle';

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
  let editableWrapper = shallow(<EditableTable {...mockProps} />);
  const notEditableWrapper = shallow(
    <EditableTable title="my title" onSaveTitle={callback} />,
  );
  it('is valid', () => {
    expect(React.isValidElement(<EditableTable {...mockProps} />)).toBe(true);
  });
  it('should render title', () => {
    const titleElement = editableWrapper.find('input');
    expect(titleElement.props().value).toBe('my title');
    expect(titleElement.props().type).toBe('button');
  });

  describe('should handle click', () => {
    it('should change title', () => {
      editableWrapper.find('input').simulate('click');
      expect(editableWrapper.find('input').props().type).toBe('text');
    });
    it('should not change title', () => {
      notEditableWrapper.find('input').simulate('click');
      expect(notEditableWrapper.find('input').props().type).toBe('button');
    });
  });

  describe('should handle change', () => {
    afterEach(() => {
      editableWrapper = shallow(<EditableTable {...mockProps} />);
    });
    it('should change title', () => {
      editableWrapper.find('input').simulate('change', mockEvent);
      expect(editableWrapper.find('input').props().value).toBe('new title');
    });
    it('should not change title', () => {
      notEditableWrapper.find('input').simulate('change', mockEvent);
      expect(editableWrapper.find('input').props().value).toBe('my title');
    });
  });

  describe('should handle blur', () => {
    beforeEach(() => {
      editableWrapper.find('input').simulate('click');
    });
    afterEach(() => {
      callback.resetHistory();
      editableWrapper = shallow(<EditableTable {...mockProps} />);
    });

    it('default input type should be text', () => {
      expect(editableWrapper.find('input').props().type).toBe('text');
    });

    it('should trigger callback', () => {
      editableWrapper.find('input').simulate('change', mockEvent);
      editableWrapper.find('input').simulate('blur');
      expect(editableWrapper.find('input').props().type).toBe('button');
      expect(callback.callCount).toBe(1);
      expect(callback.getCall(0).args[0]).toBe('new title');
    });
    it('should not trigger callback', () => {
      editableWrapper.find('input').simulate('blur');
      expect(editableWrapper.find('input').props().type).toBe('button');
      // no change
      expect(callback.callCount).toBe(0);
    });
    it('should not save empty title', () => {
      editableWrapper.find('input').simulate('blur');
      expect(editableWrapper.find('input').props().type).toBe('button');
      expect(editableWrapper.find('input').props().value).toBe('my title');
      expect(callback.callCount).toBe(0);
    });
  });
});
