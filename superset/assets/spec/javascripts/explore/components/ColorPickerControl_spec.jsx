/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';
import { SketchPicker } from 'react-color';

import ColorPickerControl from
  '../../../../src/explore/components/controls/ColorPickerControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import getCategoricalSchemeRegistry from '../../../../src/modules/colors/CategoricalSchemeRegistrySingleton';
import CategoricalScheme from '../../../../src/modules/colors/CategoricalScheme';

const defaultProps = {
  value: { },
};

describe('ColorPickerControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    getCategoricalSchemeRegistry()
      .registerValue('test', new CategoricalScheme({
        name: 'test',
        colors: ['red', 'green', 'blue'],
      }))
      .setDefaultSchemeName('test');
    wrapper = shallow(<ColorPickerControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders a Popover with a SketchPicker', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(SketchPicker)).toHaveLength(1);
  });
});
