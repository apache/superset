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
import { t } from '@superset-ui/core';
import { Select, CreatableSelect, OnPasteSelect } from 'src/components/Select';
import ControlHeader from 'src/explore/components/ControlHeader';

const propTypes = {
  autoFocus: PropTypes.bool,
  choices: PropTypes.array,
  clearable: PropTypes.bool,
  description: PropTypes.string,
  disabled: PropTypes.bool,
  freeForm: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  multi: PropTypes.bool,
  isMulti: PropTypes.bool,
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
  selectRef: PropTypes.func,
  filterOption: PropTypes.func,
  promptTextCreator: PropTypes.func,
  commaChoosesOption: PropTypes.bool,
  menuPortalTarget: PropTypes.element,
  menuPosition: PropTypes.string,
  menuPlacement: PropTypes.string,
};

const defaultProps = {
  autoFocus: false,
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
    this.select = null; // pointer to the react-select instance
    this.getSelectRef = this.getSelectRef.bind(this);
    this.handleKeyDownForCreate = this.handleKeyDownForCreate.bind(this);
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

  // Beware: This is acting like an on-click instead of an on-change
  // (firing every time user chooses vs firing only if a new option is chosen).
  onChange(opt) {
    let optionValue = this.props.multi ? [] : null;
    if (opt) {
      if (this.props.multi) {
        opt.forEach(o => {
          // select all options
          if (o.meta === true) {
            optionValue = this.getOptions(this.props)
              .filter(x => !x.meta)
              .map(x => x[this.props.valueKey]);
            return;
          }
          optionValue.push(o[this.props.valueKey] || o);
        });
      } else if (opt.meta === true) {
        return;
      } else {
        optionValue = opt[this.props.valueKey];
      }
    }
    // will eventually call `exploreReducer`: SET_FIELD_VALUE
    this.props.onChange(optionValue);
  }

  getSelectRef(instance) {
    this.select = instance;
    if (this.props.selectRef) {
      this.props.selectRef(instance);
    }
  }

  getOptions(props) {
    let options = [];
    if (props.options) {
      options = props.options.map(x => x);
    } else if (props.choices) {
      // Accepts different formats of input
      options = props.choices.map(c => {
        if (Array.isArray(c)) {
          const [value, label] = c.length > 1 ? c : [c[0], c[0]];
          return { label, [props.valueKey]: value };
        }
        if (Object.is(c)) {
          return c;
        }
        return { label: c, [props.valueKey]: c };
      });
    }
    // For FreeFormSelect, insert newly created values into options
    if (props.freeForm && props.value) {
      const existingOptionValues = new Set(options.map(c => c[props.valueKey]));
      const selectedValues = Array.isArray(props.value)
        ? props.value
        : [props.value];
      selectedValues.forEach(v => {
        if (!existingOptionValues.has(v)) {
          // place the newly created options at the top
          options.unshift({ label: v, [props.valueKey]: v });
        }
      });
    }
    if (props.allowAll === true && props.multi === true) {
      if (!this.optionsIncludesSelectAll(options)) {
        options.unshift(this.createMetaSelectAllOption());
      }
    } else {
      options = options.filter(o => !this.isMetaSelectAllOption(o));
    }
    return options;
  }

  handleKeyDownForCreate(event) {
    const { key } = event;
    if (key === 'Tab' || (this.props.commaChoosesOption && key === ',')) {
      // simulate an Enter event
      if (this.select) {
        this.select.onKeyDown({ ...event, key: 'Enter' });
      }
    }
  }

  isMetaSelectAllOption(o) {
    return o.meta && o.meta === true && o.label === 'Select All';
  }

  optionsIncludesSelectAll(o) {
    return o.findIndex(o => this.isMetaSelectAllOption(o)) >= 0;
  }

  optionsRemaining() {
    const { options } = this.state;
    const { value } = this.props;
    // if select is multi/value is array, we show the options not selected
    let remainingOptions = Array.isArray(value)
      ? options.length - value.length
      : options.length;
    if (this.optionsIncludesSelectAll(options)) {
      remainingOptions -= 1;
    }
    return remainingOptions;
  }

  createPlaceholder() {
    const optionsRemaining = this.optionsRemaining();
    const placeholder =
      this.props.placeholder || t('%s option(s)', optionsRemaining);
    return optionsRemaining ? placeholder : '';
  }

  createMetaSelectAllOption() {
    const option = { label: 'Select All', meta: true };
    option[this.props.valueKey] = 'Select All';
    return option;
  }

  render() {
    //  Tab, comma or Enter will trigger a new option created for FreeFormSelect
    const {
      autoFocus,
      clearable,
      disabled,
      filterOption,
      isLoading,
      menuPlacement,
      menuPortalTarget,
      menuPosition,
      name,
      noResultsText,
      onFocus,
      optionRenderer,
      promptTextCreator,
      value,
      valueKey,
      valueRenderer,
    } = this.props;
    const placeholder = this.createPlaceholder();
    const isMulti = this.props.isMulti || this.props.multi;

    const selectProps = {
      autoFocus,
      clearable,
      disabled,
      filterOption,
      ignoreAccents: false,
      isLoading,
      isMulti,
      labelKey: 'label',
      menuPlacement,
      menuPortalTarget,
      menuPosition,
      name: `select-${name}`,
      noResultsText,
      onChange: this.onChange,
      onFocus,
      optionRenderer,
      options: this.state.options,
      placeholder,
      promptTextCreator,
      selectRef: this.getSelectRef,
      value,
      valueKey,
      valueRenderer,
    };

    let SelectComponent;
    if (this.props.freeForm) {
      SelectComponent = CreatableSelect;
      // Don't create functions in `render` because React relies on shallow
      // compare to decide weathere to rerender child components.
      selectProps.onKeyDown = this.handleKeyDownForCreate;
    } else {
      SelectComponent = Select;
    }

    return (
      <div>
        {this.props.showHeader && <ControlHeader {...this.props} />}
        {isMulti ? (
          <OnPasteSelect {...selectProps} selectWrap={SelectComponent} />
        ) : (
          <SelectComponent {...selectProps} />
        )}
      </div>
    );
  }
}

SelectControl.propTypes = propTypes;
SelectControl.defaultProps = defaultProps;
