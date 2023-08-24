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
import { debounce } from 'lodash';
import { max as d3Max } from 'd3-array';
import {
  AsyncCreatableSelect,
  CreatableSelect,
} from 'src/components/DeprecatedSelect';
import Button from 'src/components/Button';
import {
  css,
  styled,
  t,
  SupersetClient,
  ensureIsArray,
  withTheme,
} from '@superset-ui/core';
import { Global } from '@emotion/react';

import {
  BOOL_FALSE_DISPLAY,
  BOOL_TRUE_DISPLAY,
  SLOW_DEBOUNCE,
} from 'src/constants';
import { FormLabel } from 'src/components/Form';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import ControlRow from 'src/explore/components/ControlRow';
import Control from 'src/explore/components/Control';
import { controls } from 'src/explore/controls';
import { getExploreUrl } from 'src/explore/exploreUtils';
import OnPasteSelect from 'src/components/DeprecatedSelect/OnPasteSelect';
import {
  FILTER_CONFIG_ATTRIBUTES,
  FILTER_OPTIONS_LIMIT,
  TIME_FILTER_LABELS,
  TIME_FILTER_MAP,
} from 'src/explore/constants';

// a shortcut to a map key, used by many components
export const TIME_RANGE = TIME_FILTER_MAP.time_range;

const propTypes = {
  chartId: PropTypes.number.isRequired,
  origSelectedValues: PropTypes.object,
  datasource: PropTypes.object.isRequired,
  instantFiltering: PropTypes.bool,
  filtersFields: PropTypes.arrayOf(
    PropTypes.shape({
      field: PropTypes.string,
      label: PropTypes.string,
    }),
  ),
  filtersChoices: PropTypes.objectOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        text: PropTypes.string,
        filter: PropTypes.string,
        metric: PropTypes.number,
      }),
    ),
  ),
  onChange: PropTypes.func,
  onFilterMenuOpen: PropTypes.func,
  onFilterMenuClose: PropTypes.func,
  showDateFilter: PropTypes.bool,
  showSqlaTimeGrain: PropTypes.bool,
  showSqlaTimeColumn: PropTypes.bool,
};
const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  onFilterMenuOpen: () => {},
  onFilterMenuClose: () => {},
  showDateFilter: false,
  showSqlaTimeGrain: false,
  showSqlaTimeColumn: false,
  instantFiltering: false,
};

const StyledFilterContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    margin-bottom: ${theme.gridUnit * 2 + 2}px;

    &:last-child {
      margin-bottom: 0;
    }

    label {
      display: flex;
      font-weight: ${theme.typography.weights.bold};
    }

    .filter-badge-container {
      width: 30px;
      padding-right: ${theme.gridUnit * 2 + 2}px;
    }

    .filter-badge-container + div {
      width: 100%;
    }
  `}
`;

/**
 * @deprecated in version 3.0.
 */
class FilterBox extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      selectedValues: props.origSelectedValues,
      // this flag is used by non-instant filter, to make the apply button enabled/disabled
      hasChanged: false,
    };
    this.debouncerCache = {};
    this.maxValueCache = {};
    this.changeFilter = this.changeFilter.bind(this);
    this.onFilterMenuOpen = this.onFilterMenuOpen.bind(this);
    this.onOpenDateFilterControl = this.onOpenDateFilterControl.bind(this);
    this.onFilterMenuClose = this.onFilterMenuClose.bind(this);
  }

  onFilterMenuOpen(column) {
    return this.props.onFilterMenuOpen(this.props.chartId, column);
  }

  onFilterMenuClose(column) {
    return this.props.onFilterMenuClose(this.props.chartId, column);
  }

  onOpenDateFilterControl() {
    return this.onFilterMenuOpen(TIME_RANGE);
  }

  onCloseDateFilterControl = () => this.onFilterMenuClose(TIME_RANGE);

  getControlData(controlName) {
    const { selectedValues } = this.state;
    const control = {
      ...controls[controlName], // TODO: make these controls ('granularity_sqla', 'time_grain_sqla') accessible from getControlsForVizType.
      name: controlName,
      key: `control-${controlName}`,
      value: selectedValues[TIME_FILTER_MAP[controlName]],
      actions: { setControlValue: this.changeFilter },
    };
    const mapFunc = control.mapStateToProps;
    return mapFunc ? { ...control, ...mapFunc(this.props) } : control;
  }

  /**
   * Get known max value of a column
   */
  getKnownMax(key, choices) {
    this.maxValueCache[key] = Math.max(
      this.maxValueCache[key] || 0,
      d3Max(choices || this.props.filtersChoices[key] || [], x => x.metric),
    );
    return this.maxValueCache[key];
  }

  clickApply() {
    const { selectedValues } = this.state;
    this.setState({ hasChanged: false }, () => {
      this.props.onChange(selectedValues, false);
    });
  }

  changeFilter(filter, options) {
    const fltr = TIME_FILTER_MAP[filter] || filter;
    let vals = null;
    if (options !== null) {
      if (Array.isArray(options)) {
        vals = options.map(opt => (typeof opt === 'string' ? opt : opt.value));
      } else if (Object.values(TIME_FILTER_MAP).includes(fltr)) {
        vals = options.value ?? options;
      } else {
        // must use array member for legacy extra_filters's value
        vals = ensureIsArray(options.value ?? options);
      }
    }

    this.setState(
      prevState => ({
        selectedValues: {
          ...prevState.selectedValues,
          [fltr]: vals,
        },
        hasChanged: true,
      }),
      () => {
        if (this.props.instantFiltering) {
          this.props.onChange({ [fltr]: vals }, false);
        }
      },
    );
  }

  /**
   * Generate a debounce function that loads options for a specific column
   */
  debounceLoadOptions(key) {
    if (!(key in this.debouncerCache)) {
      this.debouncerCache[key] = debounce((input, callback) => {
        this.loadOptions(key, input).then(callback);
      }, SLOW_DEBOUNCE);
    }
    return this.debouncerCache[key];
  }

  /**
   * Transform select options, add bar background
   */
  transformOptions(options, max) {
    const maxValue = max === undefined ? d3Max(options, x => x.metric) : max;
    return options.map(opt => {
      const perc = Math.round((opt.metric / maxValue) * 100);
      const color = 'lightgrey';
      const backgroundImage = `linear-gradient(to right, ${color}, ${color} ${perc}%, rgba(0,0,0,0) ${perc}%`;
      const style = { backgroundImage };
      let label = opt.id;
      if (label === true) {
        label = BOOL_TRUE_DISPLAY;
      } else if (label === false) {
        label = BOOL_FALSE_DISPLAY;
      }
      return { value: opt.id, label, style };
    });
  }

  async loadOptions(key, inputValue = '') {
    const input = inputValue.toLowerCase();
    const sortAsc = this.props.filtersFields.find(x => x.key === key).asc;
    const formData = {
      ...this.props.rawFormData,
      adhoc_filters: inputValue
        ? [
            {
              clause: 'WHERE',
              expressionType: 'SIMPLE',
              subject: key,
              operator: 'ILIKE',
              comparator: `%${input}%`,
            },
          ]
        : null,
    };

    const { json } = await SupersetClient.get({
      url: getExploreUrl({
        formData,
        endpointType: 'json',
        method: 'GET',
      }),
    });
    const options = (json?.data?.[key] || []).filter(x => x.id);
    if (!options || options.length === 0) {
      return [];
    }
    if (input) {
      // sort those starts with search query to front
      options.sort((a, b) => {
        const labelA = a.id.toLowerCase();
        const labelB = b.id.toLowerCase();
        const textOrder = labelB.startsWith(input) - labelA.startsWith(input);
        return textOrder === 0
          ? (a.metric - b.metric) * (sortAsc ? 1 : -1)
          : textOrder;
      });
    }
    return this.transformOptions(options, this.getKnownMax(key, options));
  }

  renderDateFilter() {
    const { showDateFilter } = this.props;
    const label = TIME_FILTER_LABELS.time_range;
    if (showDateFilter) {
      return (
        <div className="row space-1">
          <div
            className="col-lg-12 col-xs-12"
            data-test="date-filter-container"
          >
            <DateFilterControl
              name={TIME_RANGE}
              label={label}
              description={t('Select start and end date')}
              onChange={newValue => {
                this.changeFilter(TIME_RANGE, newValue);
              }}
              onOpenDateFilterControl={this.onOpenDateFilterControl}
              onCloseDateFilterControl={this.onCloseDateFilterControl}
              value={this.state.selectedValues[TIME_RANGE] || 'No filter'}
              endpoints={['inclusive', 'exclusive']}
            />
          </div>
        </div>
      );
    }
    return null;
  }

  renderDatasourceFilters() {
    const { showSqlaTimeGrain, showSqlaTimeColumn } = this.props;
    const datasourceFilters = [];
    const sqlaFilters = [];
    if (showSqlaTimeGrain) sqlaFilters.push('time_grain_sqla');
    if (showSqlaTimeColumn) sqlaFilters.push('granularity_sqla');
    if (sqlaFilters.length) {
      datasourceFilters.push(
        <ControlRow
          key="sqla-filters"
          controls={sqlaFilters.map(control => (
            <Control {...this.getControlData(control)} />
          ))}
        />,
      );
    }
    return datasourceFilters;
  }

  renderSelect(filterConfig) {
    const { filtersChoices } = this.props;
    const { selectedValues } = this.state;
    this.debouncerCache = {};
    this.maxValueCache = {};

    // Add created options to filtersChoices, even though it doesn't exist,
    // or these options will exist in query sql but invisible to end user.
    Object.keys(selectedValues)
      .filter(key => key in filtersChoices)
      .forEach(key => {
        // empty values are ignored
        if (!selectedValues[key]) {
          return;
        }
        const choices = filtersChoices[key] || (filtersChoices[key] = []);
        const choiceIds = new Set(choices.map(f => f.id));
        const selectedValuesForKey = Array.isArray(selectedValues[key])
          ? selectedValues[key]
          : [selectedValues[key]];
        selectedValuesForKey
          .filter(value => value !== null && !choiceIds.has(value))
          .forEach(value => {
            choices.unshift({
              filter: key,
              id: value,
              text: value,
              metric: 0,
            });
          });
      });
    const {
      key,
      label,
      [FILTER_CONFIG_ATTRIBUTES.MULTIPLE]: isMultiple,
      [FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE]: defaultValue,
      [FILTER_CONFIG_ATTRIBUTES.CLEARABLE]: isClearable,
      [FILTER_CONFIG_ATTRIBUTES.SEARCH_ALL_OPTIONS]: searchAllOptions,
    } = filterConfig;
    const data = filtersChoices[key] || [];
    let value = selectedValues[key] || null;

    // Assign default value if required
    if (value === undefined && defaultValue) {
      // multiple values are separated by semicolons
      value = isMultiple ? defaultValue.split(';') : defaultValue;
    }

    return (
      <OnPasteSelect
        cacheOptions
        loadOptions={this.debounceLoadOptions(key)}
        defaultOptions={this.transformOptions(data)}
        key={key}
        placeholder={t('Type or Select [%s]', label)}
        isMulti={isMultiple}
        isClearable={isClearable}
        value={value}
        options={this.transformOptions(data)}
        onChange={newValue => {
          // avoid excessive re-renders
          if (newValue !== value) {
            this.changeFilter(key, newValue);
          }
        }}
        // TODO try putting this back once react-select is upgraded
        // onFocus={() => this.onFilterMenuOpen(key)}
        onMenuOpen={() => this.onFilterMenuOpen(key)}
        onBlur={() => this.onFilterMenuClose(key)}
        onMenuClose={() => this.onFilterMenuClose(key)}
        selectWrap={
          searchAllOptions && data.length >= FILTER_OPTIONS_LIMIT
            ? AsyncCreatableSelect
            : CreatableSelect
        }
        noResultsText={t('No results found')}
        forceOverflow
      />
    );
  }

  renderFilters() {
    const { filtersFields = [] } = this.props;
    return filtersFields.map(filterConfig => {
      const { label, key } = filterConfig;
      return (
        <StyledFilterContainer key={key} className="filter-container">
          <FormLabel htmlFor={`LABEL-${key}`}>{label}</FormLabel>
          {this.renderSelect(filterConfig)}
        </StyledFilterContainer>
      );
    });
  }

  render() {
    const { instantFiltering, width, height } = this.props;
    const { zIndex, gridUnit } = this.props.theme;
    return (
      <>
        <Global
          styles={css`
            .dashboard .filter_box .slice_container > div:not(.alert) {
              padding-top: 0;
            }

            .filter_box {
              padding: ${gridUnit * 2 + 2}px 0;
              overflow: visible !important;

              &:hover {
                z-index: ${zIndex.max};
              }
            }
          `}
        />
        <div style={{ width, height, overflow: 'auto' }}>
          {this.renderDateFilter()}
          {this.renderDatasourceFilters()}
          {this.renderFilters()}
          {!instantFiltering && (
            <Button
              buttonSize="small"
              buttonStyle="primary"
              onClick={this.clickApply.bind(this)}
              disabled={!this.state.hasChanged}
            >
              {t('Apply')}
            </Button>
          )}
        </div>
      </>
    );
  }
}

FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

export default withTheme(FilterBox);
