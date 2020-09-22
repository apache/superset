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
import React, { SyntheticEvent, MutableRefObject, ComponentType } from 'react';
import { merge } from 'lodash';
import BasicSelect, {
  OptionTypeBase,
  MultiValueProps,
  FormatOptionLabelMeta,
  ValueType,
  SelectComponentsConfig,
  components as defaultComponents,
  createFilter,
} from 'react-select';
import Async from 'react-select/async';
import Creatable from 'react-select/creatable';
import AsyncCreatable from 'react-select/async-creatable';
import { withAsyncPaginate } from 'react-select-async-paginate';

import { SelectComponents } from 'react-select/src/components';
import {
  SortableContainer,
  SortableElement,
  SortableContainerProps,
} from 'react-sortable-hoc';
import arrayMove from 'array-move';
import { Props as SelectProps } from 'react-select/src/Select';
import {
  WindowedSelectComponentType,
  WindowedSelectProps,
  WindowedSelect,
  WindowedAsyncSelect,
  WindowedCreatableSelect,
  WindowedAsyncCreatableSelect,
} from './WindowedSelect';
import {
  DEFAULT_CLASS_NAME,
  DEFAULT_CLASS_NAME_PREFIX,
  DEFAULT_STYLES,
  DEFAULT_THEME,
  DEFAULT_COMPONENTS,
  VALUE_LABELED_STYLES,
  PartialThemeConfig,
  PartialStylesConfig,
} from './styles';
import { findValue } from './utils';

type AnyReactSelect<OptionType extends OptionTypeBase> =
  | BasicSelect<OptionType>
  | Async<OptionType>
  | Creatable<OptionType>
  | AsyncCreatable<OptionType>;

export type SupersetStyledSelectProps<
  OptionType extends OptionTypeBase,
  T extends WindowedSelectProps<OptionType> = WindowedSelectProps<OptionType>
> = T & {
  // additional props for easier usage or backward compatibility
  labelKey?: string;
  valueKey?: string;
  multi?: boolean;
  clearable?: boolean;
  sortable?: boolean;
  ignoreAccents?: boolean;
  creatable?: boolean;
  selectRef?:
    | React.RefCallback<AnyReactSelect<OptionType>>
    | MutableRefObject<AnyReactSelect<OptionType>>;
  getInputValue?: (selectBalue: ValueType<OptionType>) => string | undefined;
  optionRenderer?: (option: OptionType) => React.ReactNode;
  valueRenderer?: (option: OptionType) => React.ReactNode;
  valueRenderedAsLabel?: boolean;
  // callback for paste event
  onPaste?: (e: SyntheticEvent) => void;
  // for simplier theme overrides
  themeConfig?: PartialThemeConfig;
  stylesConfig?: PartialStylesConfig;
};

function styled<
  OptionType extends OptionTypeBase,
  SelectComponentType extends
    | WindowedSelectComponentType<OptionType>
    | ComponentType<SelectProps<OptionType>> = WindowedSelectComponentType<
    OptionType
  >
>(SelectComponent: SelectComponentType) {
  type SelectProps = SupersetStyledSelectProps<OptionType>;
  type Components = SelectComponents<OptionType>;

  const SortableSelectComponent = SortableContainer(SelectComponent, {
    withRef: true,
  });

  // default components for the given OptionType
  const supersetDefaultComponents: SelectComponentsConfig<OptionType> = DEFAULT_COMPONENTS;

  const getSortableMultiValue = (MultiValue: Components['MultiValue']) => {
    return SortableElement((props: MultiValueProps<OptionType>) => {
      const onMouseDown = (e: SyntheticEvent) => {
        e.preventDefault();
        e.stopPropagation();
      };
      const innerProps = { onMouseDown };
      return <MultiValue {...props} innerProps={innerProps} />;
    });
  };

  /**
   * Superset styled `Select` component. Apply Superset themed stylesheets and
   * consolidate props API for backward compatibility with react-select v1.
   */
  function StyledSelect(selectProps: SelectProps) {
    let stateManager: AnyReactSelect<OptionType>; // reference to react-select StateManager
    const {
      // additional props for Superset Select
      selectRef,
      labelKey = 'label',
      valueKey = 'value',
      themeConfig,
      stylesConfig = {},
      optionRenderer,
      valueRenderer,
      // whether value is rendered as `option-label` in input,
      // useful for AdhocMetric and AdhocFilter
      valueRenderedAsLabel: valueRenderedAsLabel_,
      onPaste,
      multi = false, // same as `isMulti`, used for backward compatibility
      clearable, // same as `isClearable`
      sortable = true, // whether to enable drag & drop sorting

      // react-select props
      className = DEFAULT_CLASS_NAME,
      classNamePrefix = DEFAULT_CLASS_NAME_PREFIX,
      options,
      value: value_,
      components: components_,
      isMulti: isMulti_,
      isClearable: isClearable_,
      minMenuHeight = 100, // apply different defaults
      maxMenuHeight = 220,
      filterOption,
      ignoreAccents = false, // default is `true`, but it is slow

      getOptionValue = option =>
        typeof option === 'string' ? option : option[valueKey],

      getOptionLabel = option =>
        typeof option === 'string'
          ? option
          : option[labelKey] || option[valueKey],

      formatOptionLabel = (
        option: OptionType,
        { context }: FormatOptionLabelMeta<OptionType>,
      ) => {
        if (context === 'value') {
          return valueRenderer ? valueRenderer(option) : getOptionLabel(option);
        }
        return optionRenderer ? optionRenderer(option) : getOptionLabel(option);
      },

      ...restProps
    } = selectProps;

    // `value` may be rendered values (strings), we want option objects
    const value: OptionType[] = findValue(value_, options || [], valueKey);

    // Add backward compability to v1 API
    const isMulti = isMulti_ === undefined ? multi : isMulti_;
    const isClearable = isClearable_ === undefined ? clearable : isClearable_;

    // Sort is only applied when there are multiple selected values
    const shouldAllowSort =
      isMulti && sortable && Array.isArray(value) && value.length > 1;

    const MaybeSortableSelect = shouldAllowSort
      ? SortableSelectComponent
      : SelectComponent;
    const components = { ...supersetDefaultComponents, ...components_ };

    // Make multi-select sortable as per https://react-select.netlify.app/advanced
    if (shouldAllowSort) {
      components.MultiValue = getSortableMultiValue(
        components.MultiValue || defaultComponents.MultiValue,
      );

      const sortableContainerProps: Partial<SortableContainerProps> = {
        getHelperDimensions: ({ node }) => node.getBoundingClientRect(),
        axis: 'xy',
        onSortEnd: ({ oldIndex, newIndex }) => {
          const newValue = arrayMove(value, oldIndex, newIndex);
          if (restProps.onChange) {
            restProps.onChange(newValue, { action: 'set-value' });
          }
        },
        distance: 4,
      };
      Object.assign(restProps, sortableContainerProps);
    }

    // When values are rendered as labels, adjust valueContainer padding
    const valueRenderedAsLabel =
      valueRenderedAsLabel_ === undefined ? isMulti : valueRenderedAsLabel_;
    if (valueRenderedAsLabel && !stylesConfig.valueContainer) {
      Object.assign(stylesConfig, VALUE_LABELED_STYLES);
    }

    // Handle onPaste event
    if (onPaste) {
      const Input = components.Input || defaultComponents.Input;
      // @ts-ignore (needed for passing `onPaste`)
      components.Input = props => <Input {...props} onPaste={onPaste} />;
    }
    // for CreaTable
    if (SelectComponent === WindowedCreatableSelect) {
      restProps.getNewOptionData = (inputValue: string, label: string) => ({
        label: label || inputValue,
        [valueKey]: inputValue,
        isNew: true,
      });
    }

    // Make sure always return StateManager for the refs.
    // To get the real `Select` component, keep tap into `obj.select`:
    //   - for normal <Select /> component: StateManager -> Select,
    //   - for <Creatable />: StateManager -> Creatable -> Select
    const setRef = (instance: any) => {
      stateManager =
        shouldAllowSort && instance && 'refs' in instance
          ? instance.refs.wrappedInstance // obtain StateManger from SortableContainer
          : instance;
      if (typeof selectRef === 'function') {
        selectRef(stateManager);
      } else if (selectRef && 'current' in selectRef) {
        selectRef.current = stateManager;
      }
    };

    return (
      <MaybeSortableSelect
        ref={setRef}
        className={className}
        classNamePrefix={classNamePrefix}
        isMulti={isMulti}
        isClearable={isClearable}
        options={options}
        value={value}
        minMenuHeight={minMenuHeight}
        maxMenuHeight={maxMenuHeight}
        filterOption={
          // filterOption may be NULL
          filterOption !== undefined
            ? filterOption
            : createFilter({ ignoreAccents })
        }
        styles={{ ...DEFAULT_STYLES, ...stylesConfig } as SelectProps['styles']}
        // merge default theme from `react-select`, default theme for Superset,
        // and the theme from props.
        theme={defaultTheme => merge(defaultTheme, DEFAULT_THEME, themeConfig)}
        formatOptionLabel={formatOptionLabel}
        getOptionLabel={getOptionLabel}
        getOptionValue={getOptionValue}
        components={components}
        {...restProps}
      />
    );
  }

  // React.memo makes sure the component does no rerender given the same props
  return React.memo(StyledSelect);
}

export const Select = styled(WindowedSelect);
export const AsyncSelect = styled(WindowedAsyncSelect);
export const CreatableSelect = styled(WindowedCreatableSelect);
export const AsyncCreatableSelect = styled(WindowedAsyncCreatableSelect);
export const PaginatedSelect = withAsyncPaginate(styled(BasicSelect));
export default Select;
