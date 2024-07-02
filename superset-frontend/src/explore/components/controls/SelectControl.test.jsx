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
import sinon from 'sinon';
import { shallow } from 'enzyme';
import { Select as SelectComponent } from 'src/components';
import SelectControl from 'src/explore/components/controls/SelectControl';
import { styledMount as mount } from 'spec/helpers/theming';

const defaultProps = {
  choices: [
    ['1 year ago', '1 year ago'],
    ['1 week ago', '1 week ago'],
    ['today', 'today'],
  ],
  name: 'row_limit',
  label: 'Row Limit',
  valueKey: 'value', // shallow isn't passing SelectControl.defaultProps.valueKey through
  onChange: sinon.spy(),
};

const options = [
  { value: '1 year ago', label: '1 year ago' },
  { value: '1 week ago', label: '1 week ago' },
  { value: 'today', label: 'today' },
];

describe('SelectControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<SelectControl {...defaultProps} />);
  });

  it('calls props.onChange when select', () => {
    const select = wrapper.instance();
    select.onChange(50);
    expect(defaultProps.onChange.calledWith(50)).toBe(true);
  });

  describe('render', () => {
    it('renders with Select by default', () => {
      expect(wrapper.find(SelectComponent)).toExist();
    });

    it('renders as mode multiple', () => {
      wrapper.setProps({ multi: true });
      expect(wrapper.find(SelectComponent)).toExist();
      expect(wrapper.find(SelectComponent).prop('mode')).toBe('multiple');
    });

    it('renders with allowNewOptions when freeForm', () => {
      wrapper.setProps({ freeForm: true });
      expect(wrapper.find(SelectComponent)).toExist();
      expect(wrapper.find(SelectComponent).prop('allowNewOptions')).toBe(true);
    });

    it('renders with allowNewOptions=false when freeForm=false', () => {
      wrapper.setProps({ freeForm: false });
      expect(wrapper.find(SelectComponent)).toExist();
      expect(wrapper.find(SelectComponent).prop('allowNewOptions')).toBe(false);
    });

    it('renders with tokenSeparators', () => {
      wrapper.setProps({ tokenSeparators: ['\n', '\t', ';'] });
      expect(wrapper.find(SelectComponent)).toExist();
      expect(wrapper.find(SelectComponent).prop('tokenSeparators')).toEqual(
        expect.arrayContaining([expect.any(String)]),
      );
    });

    describe('empty placeholder', () => {
      describe('withMulti', () => {
        it('does not show a placeholder if there are no choices', () => {
          const withMulti = mount(
            <SelectControl
              {...defaultProps}
              choices={[]}
              multi
              placeholder="add something"
            />,
          );
          expect(withMulti.html()).not.toContain('option(s');
        });
      });
      describe('withSingleChoice', () => {
        it('does not show a placeholder if there are no choices', () => {
          const singleChoice = mount(
            <SelectControl
              {...defaultProps}
              choices={[]}
              multi
              placeholder="add something"
            />,
          );
          expect(singleChoice.html()).not.toContain('option(s');
        });
      });
      describe('default placeholder', () => {
        it('does not show a placeholder if there are no options', () => {
          const defaultPlaceholder = mount(
            <SelectControl {...defaultProps} choices={[]} multi />,
          );
          expect(defaultPlaceholder.html()).not.toContain('option(s');
        });
      });
      describe('all choices selected', () => {
        it('does not show a placeholder', () => {
          const allChoicesSelected = mount(
            <SelectControl
              {...defaultProps}
              multi
              value={['today', '1 year ago']}
            />,
          );
          expect(allChoicesSelected.html()).not.toContain('option(s');
        });
      });
    });
    describe('when select is multi', () => {
      it('does not render the placeholder when a selection has been made', () => {
        wrapper = mount(
          <SelectControl
            {...defaultProps}
            multi
            value={['today']}
            placeholder="add something"
          />,
        );
        expect(wrapper.html()).not.toContain('add something');
      });
    });
    describe('when select is single', () => {
      it('does not render the placeholder when a selection has been made', () => {
        wrapper = mount(
          <SelectControl
            {...defaultProps}
            value={50}
            placeholder="add something"
          />,
        );
        expect(wrapper.html()).not.toContain('add something');
      });
    });
  });

  describe('getOptions', () => {
    it('returns the correct options', () => {
      wrapper.setProps(defaultProps);
      expect(wrapper.instance().getOptions(defaultProps)).toEqual(options);
    });
  });
});
