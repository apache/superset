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
import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import Select, { Creatable } from 'react-select';
import { t } from '@superset-ui/translation';

import ControlHeader from '../ControlHeader';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';

const propTypes = {
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  multi: PropTypes.bool,
  allowAll: PropTypes.bool,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  onFocus: PropTypes.func,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.array,
  ]),
  showHeader: PropTypes.bool,
  optionRenderer: PropTypes.func,
  valueRenderer: PropTypes.func,
  valueKey: PropTypes.string,
  options: PropTypes.array,
  placeholder: PropTypes.string,
  noResultsText: PropTypes.string,
  refFunc: PropTypes.func,
  filterOption: PropTypes.func,
  promptTextCreator: PropTypes.func,
  commaChoosesOption: PropTypes.bool,
};

const defaultProps = {
  choices: [],
  clearable: true,
  description: null,
  disabled: false,
  freeForm: false,
  isLoading: false,
  label: null,
  multi: false,
  onChange: () => {},
  onFocus: () => {},
  showHeader: true,
  optionRenderer: opt => opt.label,
  valueRenderer: opt => opt.label,
  valueKey: 'value',
  noResultsText: t('No results found'),
  promptTextCreator: label => `Create Option ${label}`,
  commaChoosesOption: true,
  allowAll: false,
};

export default class SelectControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { options: this.getOptions(props) };
    this.onChange = this.onChange.bind(this);
    this.createMetaSelectAllOption = this.createMetaSelectAllOption.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      nextProps.choices !== this.props.choices ||
      nextProps.options !== this.props.options
    ) {
      const options = this.getOptions(nextProps);
      this.setState({ options });
    }
  }

  onChange(opt) {
    let optionValue = null;
    if (opt) {
      if (this.props.multi) {
        optionValue = [];
        for (const o of opt) {
          if (o.meta === true) {
            optionValue = this.getOptions(this.props)
              .filter(x => !x.meta)
              .map(x => x[this.props.valueKey]);
            break;
          } else {
            optionValue.push(o[this.props.valueKey]);
          }
        }
      } else if (opt.meta === true) {
        return;
      } else {
        optionValue = opt[this.props.valueKey];
      }
    }
    this.props.onChange(optionValue);
  }

  getOptions(props) {
    let options = [];
    if (props.options) {
      options = props.options.map(x => x);
    } else {
      // Accepts different formats of input
      options = props.choices.map(c => {
        let option;
        if (Array.isArray(c)) {
          const label = c.length > 1 ? c[1] : c[0];
          option = { label };
          option[props.valueKey] = c[0];
        } else if (Object.is(c)) {
          option = c;
        } else {
          option = { label: c };
          option[props.valueKey] = c;
        }
        return option;
      });
    }
    if (props.freeForm) {
      // For FreeFormSelect, insert value into options if not exist
      const values = options.map(c => c[props.valueKey]);
      if (props.value) {
        let valuesToAdd = props.value;
        if (!Array.isArray(valuesToAdd)) {
          valuesToAdd = [valuesToAdd];
        }
        valuesToAdd.forEach(v => {
          if (values.indexOf(v) < 0) {
            const toAdd = { label: v };
            toAdd[props.valueKey] = v;
            options.push(toAdd);
          }
        });
      }
    }
    if (props.allowAll === true && props.multi === true) {
      if (options.findIndex(o => this.isMetaSelectAllOption(o)) < 0) {
        options.unshift(this.createMetaSelectAllOption());
      }
    } else {
      options = options.filter(o => !this.isMetaSelectAllOption(o));
    }
    return options;
  }

  isMetaSelectAllOption(o) {
    return o.meta && o.meta === true && o.label === 'Select All';
  }

  createMetaSelectAllOption() {
    const option = { label: 'Select All', meta: true };
    option[this.props.valueKey] = 'Select All';
    return option;
  }

  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const placeholder =
      this.props.placeholder || t('%s option(s)', this.state.options.length);
    const selectProps = {
      multi: this.props.multi,
      name: `select-${this.props.name}`,
      placeholder,
      options: this.state.options,
      value: this.props.value,
      labelKey: 'label',
      valueKey: this.props.valueKey,
      autosize: false,
      clearable: this.props.clearable,
      isLoading: this.props.isLoading,
      onChange: this.onChange,
      onFocus: this.props.onFocus,
      optionRenderer: VirtualizedRendererWrap(this.props.optionRenderer),
      valueRenderer: this.props.valueRenderer,
      noResultsText: this.props.noResultsText,
      disabled: this.props.disabled,
      refFunc: this.props.refFunc,
      filterOption: this.props.filterOption,
      promptTextCreator: this.props.promptTextCreator,
    };
    if (this.props.freeForm) {
      selectProps.selectComponent = Creatable;
      selectProps.shouldKeyDownEventCreateNewOption = key => {
        const keyCode = key.keyCode;
        if (this.props.commaChoosesOption && keyCode === 188) {
          return true;
        }
        return keyCode === 9 || keyCode === 13;
      };
    } else {
      selectProps.selectComponent = Select;
    }
    return (
      <div>
        {this.props.showHeader && <ControlHeader {...this.props} />}
        <OnPasteSelect {...selectProps} selectWrap={VirtualizedSelect} />
      </div>
    );
  }
}

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
