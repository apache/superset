import React from 'react';
import Resizable from 're-resizable';
import { shallow } from 'enzyme';

import ResizableContainer from '../../../../../src/dashboard/components/resizable/ResizableContainer';

describe('ResizableContainer', () => {
  const props = { editMode: false, id: 'id' };

  function setup(propOverrides) {
    return shallow(<ResizableContainer {...props} {...propOverrides} />);
  }

  it('should render a Resizable', () => {
    const wrapper = setup();
    expect(wrapper.find(Resizable)).toHaveLength(1);
  });
});
