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
import { Select, CreatableSelect } from 'src/components/Select';
import OnPasteSelect from 'src/components/Select/OnPasteSelect';
import SelectControl from 'src/explore/components/controls/SelectControl';

const defaultProps = {
  choices: [
    ['1 year ago', '1 year ago'],
    ['today', 'today'],
  ],
  name: 'row_limit',
  label: 'Row Limit',
  valueKey: 'value', // shallow isn't passing SelectControl.defaultProps.valueKey through
  onChange: sinon.spy(),
};

const options = [
  { value: '1 year ago', label: '1 year ago' },
  { value: 'today', label: 'today' },
];

describe('SelectControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SelectControl {...defaultProps} />);
  });

  it('renders with Select by default', () => {
    expect(wrapper.find(OnPasteSelect)).not.toExist();
    expect(wrapper.findWhere(x => x.type() === Select)).toHaveLength(1);
  });

  it('renders with OnPasteSelect when multi', () => {
    wrapper.setProps({ multi: true });
    expect(wrapper.find(OnPasteSelect)).toExist();
    expect(wrapper.findWhere(x => x.type() === Select)).toHaveLength(0);
  });

  it('renders with Creatable when freeForm', () => {
    wrapper.setProps({ freeForm: true });
    expect(wrapper.find(OnPasteSelect)).not.toExist();
    expect(wrapper.findWhere(x => x.type() === CreatableSelect)).toHaveLength(
      1,
    );
  });

  it('uses Select in onPasteSelect when freeForm=false', () => {
    wrapper = shallow(<SelectControl {...defaultProps} multi />);
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectWrap).toBe(Select);
  });

  it('uses Creatable in onPasteSelect when freeForm=true', () => {
    wrapper = shallow(<SelectControl {...defaultProps} multi freeForm />);
    const select = wrapper.find(OnPasteSelect);
    expect(select.props().selectWrap).toBe(CreatableSelect);
  });

  it('calls props.onChange when select', () => {
    const select = wrapper.instance();
    select.onChange({ value: 50 });
    expect(defaultProps.onChange.calledWith(50)).toBe(true);
  });

  it('returns all options on select all', () => {
    const expectedValues = ['one', 'two'];
    const selectAllProps = {
      multi: true,
      allowAll: true,
      choices: expectedValues,
      name: 'row_limit',
      label: 'Row Limit',
      valueKey: 'value',
      onChange: sinon.spy(),
    };
    wrapper.setProps(selectAllProps);
    wrapper.instance().onChange([{ meta: true, value: 'Select All' }]);
    expect(selectAllProps.onChange.calledWith(expectedValues)).toBe(true);
  });

  describe('getOptions', () => {
    it('returns the correct options', () => {
      wrapper.setProps(defaultProps);
      expect(wrapper.instance().getOptions(defaultProps)).toEqual(options);
    });

    it('shows Select-All when enabled', () => {
      const selectAllProps = {
        choices: ['one', 'two'],
        name: 'name',
        freeForm: true,
        allowAll: true,
        multi: true,
        valueKey: 'value',
      };
      wrapper.setProps(selectAllProps);
      expect(wrapper.instance().getOptions(selectAllProps)).toContainEqual({
        label: 'Select All',
        meta: true,
        value: 'Select All',
      });
    });

    it('returns the correct options when freeform is set to true', () => {
      const freeFormProps = {
        choices: [],
        freeForm: true,
        value: ['one', 'two'],
        name: 'row_limit',
        label: 'Row Limit',
        valueKey: 'custom_value_key',
        onChange: sinon.spy(),
      };
      // the last added option is at the top
      const expectedNewOptions = [
        { custom_value_key: 'two', label: 'two' },
        { custom_value_key: 'one', label: 'one' },
      ];
      wrapper.setProps(freeFormProps);
      expect(wrapper.instance().getOptions(freeFormProps)).toEqual(
        expectedNewOptions,
      );
    });
  });

  describe('componentWillReceiveProps', () => {
    it('sets state.options if props.choices has changed', () => {
      const updatedOptions = [
        { value: 'three', label: 'three' },
        { value: 'four', label: 'four' },
      ];
      const newProps = {
        choices: [
          ['three', 'three'],
          ['four', 'four'],
        ],
        name: 'name',
        freeForm: false,
        value: null,
      };
      wrapper.setProps(newProps);
      expect(wrapper.state().options).toEqual(updatedOptions);
    });
  });
});
