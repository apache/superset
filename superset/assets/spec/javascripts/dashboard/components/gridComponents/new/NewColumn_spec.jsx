import React from 'react';
import { shallow } from 'enzyme';
import { expect } from 'chai';

import DraggableNewComponent from '../../../../../../src/dashboard/components/gridComponents/new/DraggableNewComponent';
import NewColumn from '../../../../../../src/dashboard/components/gridComponents/new/NewColumn';

import { NEW_COLUMN_ID } from '../../../../../../src/dashboard/util/constants';
import { COLUMN_TYPE } from '../../../../../../src/dashboard/util/componentTypes';

describe('NewColumn', () => {
  function setup() {
    return shallow(<NewColumn />);
  }

  it('should render a DraggableNewComponent', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent)).to.have.length(1);
  });

  it('should set appropriate type and id', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent).props()).to.include({
      type: COLUMN_TYPE,
      id: NEW_COLUMN_ID,
    });
  });
});
