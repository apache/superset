import React from 'react';
import { shallow } from 'enzyme';

import DraggableNewComponent from '../../../../../../src/dashboard/components/gridComponents/new/DraggableNewComponent';
import NewTabs from '../../../../../../src/dashboard/components/gridComponents/new/NewTabs';

import { NEW_TABS_ID } from '../../../../../../src/dashboard/util/constants';
import { TABS_TYPE } from '../../../../../../src/dashboard/util/componentTypes';

describe('NewTabs', () => {
  function setup() {
    return shallow(<NewTabs />);
  }

  it('should render a DraggableNewComponent', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent)).toHaveLength(1);
  });

  it('should set appropriate type and id', () => {
    const wrapper = setup();
    expect(wrapper.find(DraggableNewComponent).props()).toMatchObject({
      type: TABS_TYPE,
      id: NEW_TABS_ID,
    });
  });
});
