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
/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow } from 'enzyme';
import {
  Select,
  OnPasteSelect,
  CreatableSelect,
} from 'src/components/DeprecatedSelect';

const defaultProps = {
  onChange: sinon.spy(),
  isMulti: true,
  isValidNewOption: sinon.spy(s => !!s.label),
  value: [],
  options: [
    { value: 'United States', label: 'United States' },
    { value: 'China', label: 'China' },
    { value: 'India', label: 'India' },
    { value: 'Canada', label: 'Canada' },
    { value: 'Russian Federation', label: 'Russian Federation' },
    { value: 'Japan', label: 'Japan' },
    { value: 'Mexico', label: 'Mexico' },
  ],
};

const defaultEvt = {
  preventDefault: sinon.spy(),
  clipboardData: {
    getData: sinon.spy(() => ' United States, China, India, Canada, '),
  },
};

describe('OnPasteSelect', () => {
  let wrapper;
  let props;
  let evt;
  let expected;
  beforeEach(() => {
    props = { ...defaultProps };
    wrapper = shallow(<OnPasteSelect {...props} />);
    evt = { ...defaultEvt };
  });

  it('renders the supplied selectWrap component', () => {
    const select = wrapper.findWhere(x => x.type() === Select);
    expect(select).toHaveLength(1);
  });

  it('renders custom selectWrap components', () => {
    props.selectWrap = CreatableSelect;
    wrapper = shallow(<OnPasteSelect {...props} />);
    expect(wrapper.findWhere(x => x.type() === CreatableSelect)).toHaveLength(
      1,
    );
  });

  describe('onPaste', () => {
    it('calls onChange with pasted comma separated values', () => {
      wrapper.instance().onPaste(evt);
      expected = props.options.slice(0, 4);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(5);
    });

    it('calls onChange with pasted new line separated values', () => {
      evt.clipboardData.getData = sinon.spy(
        () => 'United States\nChina\nRussian Federation\nIndia',
      );
      wrapper.instance().onPaste(evt);
      expected = [
        props.options[0],
        props.options[1],
        props.options[4],
        props.options[2],
      ];
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(9);
    });

    it('calls onChange with pasted tab separated values', () => {
      evt.clipboardData.getData = sinon.spy(
        () => 'Russian Federation\tMexico\tIndia\tCanada',
      );
      wrapper.instance().onPaste(evt);
      expected = [
        props.options[4],
        props.options[6],
        props.options[2],
        props.options[3],
      ];
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(13);
    });

    it('calls onChange without duplicate values and adds new comma separated values', () => {
      evt.clipboardData.getData = sinon.spy(
        () => 'China, China, China, China, Mexico, Mexico, Chi na, Mexico, ',
      );
      expected = [
        props.options[1],
        props.options[6],
        { label: 'Chi na', value: 'Chi na' },
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(17);
      expect(props.options[0].value).toBe(expected[2].value);
      props.options.splice(0, 1);
    });

    it('calls onChange without duplicate values and parses new line separated values', () => {
      evt.clipboardData.getData = sinon.spy(
        () => 'United States\nCanada\nMexico\nUnited States\nCanada',
      );
      expected = [props.options[0], props.options[3], props.options[6]];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(20);
    });

    it('calls onChange without duplicate values and parses tab separated values', () => {
      evt.clipboardData.getData = sinon.spy(
        () => 'China\tIndia\tChina\tRussian Federation\tJapan\tJapan',
      );
      expected = [
        props.options[1],
        props.options[2],
        props.options[4],
        props.options[5],
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(24);
    });

    it('calls onChange with currently selected values and new comma separated values', () => {
      props.value = ['United States', 'Canada', 'Mexico'];
      evt.clipboardData.getData = sinon.spy(
        () => 'United States, Canada, Japan, India',
      );
      wrapper = shallow(<OnPasteSelect {...props} />);
      expected = [
        props.options[0],
        props.options[3],
        props.options[6],
        props.options[5],
        props.options[2],
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(26);
    });

    it('calls onChange with currently selected values and new "new line" separated values', () => {
      props.value = ['China', 'India', 'Japan'];
      evt.clipboardData.getData = sinon.spy(() => 'Mexico\nJapan\nIndia');
      wrapper = shallow(<OnPasteSelect {...props} />);
      expected = [
        props.options[1],
        props.options[2],
        props.options[5],
        props.options[6],
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(27);
    });

    it('calls onChange with currently selected values and new tab separated values', () => {
      props.value = ['United States', 'Canada', 'Mexico', 'Russian Federation'];
      evt.clipboardData.getData = sinon.spy(
        () => 'United States\tCanada\tJapan\tIndia',
      );
      wrapper = shallow(<OnPasteSelect {...props} />);
      expected = [
        props.options[0],
        props.options[3],
        props.options[6],
        props.options[4],
        props.options[5],
        props.options[2],
      ];
      wrapper.instance().onPaste(evt);
      expect(props.onChange.calledWith(expected)).toBe(true);
      expect(evt.preventDefault.called).toBe(true);
      expect(props.isValidNewOption.callCount).toBe(29);
    });
  });
});
