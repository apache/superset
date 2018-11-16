import React from 'react';
import { shallow } from 'enzyme';

import ResizableHandle from '../../../../../src/dashboard/components/resizable/ResizableHandle';

describe('ResizableHandle', () => {
  it('should render a right resize handle', () => {
    const wrapper = shallow(<ResizableHandle.right />);
    expect(wrapper.find('.resize-handle.resize-handle--right')).toHaveLength(1);
  });

  it('should render a bottom resize handle', () => {
    const wrapper = shallow(<ResizableHandle.bottom />);
    expect(wrapper.find('.resize-handle.resize-handle--bottom')).toHaveLength(
      1,
    );
  });

  it('should render a bottomRight resize handle', () => {
    const wrapper = shallow(<ResizableHandle.bottomRight />);
    expect(
      wrapper.find('.resize-handle.resize-handle--bottom-right'),
    ).toHaveLength(1);
  });
});
