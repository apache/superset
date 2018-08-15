import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';

import DraggableNewComponent from '../../../../../../src/dashboard/components/gridComponents/new/DraggableNewComponent';
import NewHeader from '../../../../../../src/dashboard/components/gridComponents/new/NewHeader';

import { NEW_HEADER_ID } from '../../../../../../src/dashboard/util/constants';
import { HEADER_TYPE } from '../../../../../../src/dashboard/util/componentTypes';

describe('NewHeader', () => {
  function setup() {
    return shallow(<NewHeader />);
  }

  it('should render a DraggableNewComponent', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent)).to.have.length(1);
  });

  it('should set appropriate type and id', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent).props()).to.include({
      type: HEADER_TYPE,
      id: NEW_HEADER_ID,
    });
  });
});
