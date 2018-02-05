/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { shallow } from 'enzyme';
import { Button } from 'react-bootstrap';
import { CompactPicker } from 'react-color';

import ColumnControl from '../../../../javascripts/explore/components/controls/ColumnControl';
import ControlHeader from '../../../../javascripts/explore/components/ControlHeader';
import SelectControl from '../../../../javascripts/explore/components/controls/SelectControl';
import TextControl from '../../../../javascripts/explore/components/controls/TextControl';

const defaultProps = {
  name: 'column configuration',
  value: {
    'sum__num,boy': {
      bcColoringOption: {
        hex: '#009ce0',
        rgb: { b: 224, r: 0, g: 156, a: 1 },
      },
      coloringOption: {
        hex: '#fe9200',
        rgb: { r: 254, g: 146, b: 0, a: 1 },
      },
      textAlign: 'right',
      formatting: '.4r',
      comparisionOption: 'contains',
      basement: '1',
    },
    sum__num: {
      formatting: '.3%',
      bcColoringOption: {
        hex: '#fda1ff',
        rgb: { r: 253, g: 161, b: 255, a: 1 },
      },
    },
  },
  formData: {
    viz_type: 'pivot_table',
    metrics: ['sum__num'],
    columns: ['gender'],
  },
  label: 'column configuration',
  onChange: sinon.spy(),
  columns: [['sum__num', 'boy'], ['sum__num', 'girl'], ['sum__num', 'All']],
};

describe('ColumnControl', () => {
  let wrapper;
  let selectMetric;

  beforeEach(() => {
    wrapper = shallow(<ColumnControl {...defaultProps} />);
    selectMetric = wrapper.find(SelectControl).at(0);
    selectMetric.simulate('change', 'sum__num');
  });

  it('gets the rigt state after metric selection', () => {
    expect(wrapper.state().selectedMetric).to.equal('sum__num');
  });
  it('renders 2 ControlHeader', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).to.have.lengthOf(2);
  });
  it('renders 6 select sections, 2 color picker and 2 button', () => {
    expect(wrapper.find(SelectControl)).to.have.lengthOf(6);
    expect(wrapper.find(CompactPicker)).to.have.lengthOf(2);
    expect(wrapper.find(Button)).to.have.lengthOf(2);
  });
  it('renders 1 metric choice', () => {
    expect(wrapper.find(SelectControl).at(0).prop('choices')).to.have.lengthOf(1);
  });
  it('renders 3 column choice', () => {
    expect(wrapper.find(SelectControl).at(1).prop('choices')).to.have.lengthOf(3);
  });
  it('renders 3 text align choices', () => {
    expect(wrapper.find(SelectControl).at(2).prop('choices')).to.have.lengthOf(3);
  });
  it('renders 6 formatting choices', () => {
    expect(wrapper.find(SelectControl).at(3).prop('choices')).to.have.lengthOf(6);
  });
  it('renders 6 comparision choices', () => {
    expect(wrapper.find(SelectControl).at(4).prop('choices')).to.have.lengthOf(6);
  });
  it('renders 2 font weight choices', () => {
    expect(wrapper.find(SelectControl).at(5).prop('choices')).to.have.lengthOf(2);
  });
  it('renders 1 text section for basement setting', () => {
    expect(wrapper.find(TextControl)).to.have.lengthOf(1);
  });
  it('calls onChange when select is changed or button is clicked', () => {
    const cancelBgColorButton = wrapper.find(Button).at(0);
    cancelBgColorButton.simulate('click');
    const selectTextAlign = wrapper.find(SelectControl).at(2);
    selectTextAlign.simulate('change', 'left');
    const selectFormatting = wrapper.find(SelectControl).at(3);
    selectFormatting.simulate('change', '.3%');
    const selectComparision = wrapper.find(SelectControl).at(4);
    selectComparision.simulate('change', '<');
    const cancelColorButton = wrapper.find(Button).at(1);
    cancelColorButton.simulate('click');
    const selectFont = wrapper.find(SelectControl).at(5);
    selectFont.simulate('change', 'normal');
    expect(defaultProps.onChange).to.have.property('callCount', 6);
  });
});
