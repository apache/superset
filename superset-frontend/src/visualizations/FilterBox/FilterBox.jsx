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
import { AsyncCreatableSelect, CreatableSelect } from 'src/components/Select';
import Button from 'src/components/Button';
import { t, styled, SupersetClient } from '@superset-ui/core';

import { BOOL_FALSE_DISPLAY, BOOL_TRUE_DISPLAY } from 'src/constants';
import FormLabel from 'src/components/FormLabel';
import DateFilterControl from 'src/explore/components/controls/DateFilterControl';
import ControlRow from 'src/explore/components/ControlRow';
import Control from 'src/explore/components/Control';
import { controls } from 'src/explore/controls';
import { getExploreUrl } from 'src/explore/exploreUtils';
import OnPasteSelect from 'src/components/Select/OnPasteSelect';
import {
  FILTER_CONFIG_ATTRIBUTES,
  FILTER_OPTIONS_LIMIT,
  TIME_FILTER_LABELS,
} from 'src/explore/constants';

import './FilterBox.less';

// maps control names to their key in extra_filters
export const TIME_FILTER_MAP = {
  time_range: '__time_range',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};

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
  showDruidTimeGrain: PropTypes.bool,
  showDruidTimeOrigin: PropTypes.bool,
};
const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  onFilterMenuOpen: () => {},
  onFilterMenuClose: () => {},
  showDateFilter: false,
  showSqlaTimeGrain: false,
  showSqlaTimeColumn: false,
  showDruidTimeGrain: false,
  showDruidTimeOrigin: false,
  instantFiltering: false,
};

const Styles = styled.div`
  height: 100%;
  min-height: 100%;
  max-height: 100%;
  overflow: visible;
`;

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

  onCloseDateFilterControl = () => {
    return this.onFilterMenuClose(TIME_RANGE);
  };

  getControlData(controlName) {
    const { selectedValues } = this.state;
    const control = {
      ...controls[controlName], // TODO: make these controls ('druid_time_origin', 'granularity', 'granularity_sqla', 'time_grain_sqla') accessible from getControlsForVizType.
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
      } else if (options.value) {
        vals = options.value;
      } else {
        vals = options;
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
      }, 500);
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
              comparator: null,
              expressionType: 'SQL',
              // TODO: Evaluate SQL Injection risk
              sqlExpression: `lower(${key}) like '%${input}%'`,
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
            className="col-lg-12 col-xs-12 filter-container"
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
            />
          </div>
        </div>
      );
    }
    return null;
  }

  renderDatasourceFilters() {
    const {
      showSqlaTimeGrain,
      showSqlaTimeColumn,
      showDruidTimeGrain,
      showDruidTimeOrigin,
    } = this.props;
    const datasourceFilters = [];
    const sqlaFilters = [];
    const druidFilters = [];
    if (showSqlaTimeGrain) sqlaFilters.push('time_grain_sqla');
    if (showSqlaTimeColumn) sqlaFilters.push('granularity_sqla');
    if (showDruidTimeGrain) druidFilters.push('granularity');
    if (showDruidTimeOrigin) druidFilters.push('druid_time_origin');
    if (sqlaFilters.length) {
      datasourceFilters.push(
        <ControlRow
          key="sqla-filters"
          className="control-row"
          controls={sqlaFilters.map(control => (
            <Control {...this.getControlData(control)} />
          ))}
        />,
      );
    }
    if (druidFilters.length) {
      datasourceFilters.push(
        <ControlRow
          key="druid-filters"
          className="control-row"
          controls={druidFilters.map(control => (
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
      .filter(
        key => selectedValues.hasOwnProperty(key) && key in filtersChoices,
      )
      .forEach(key => {
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
    const { key, label } = filterConfig;
    const data = filtersChoices[key] || [];
    let value = selectedValues[key] || null;

    // Assign default value if required
    if (
      value === undefined &&
      filterConfig[FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE]
    ) {
      if (filterConfig[FILTER_CONFIG_ATTRIBUTES.MULTIPLE]) {
        // Support for semicolon-delimited multiple values
        value = filterConfig[FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE].split(';');
      } else {
        value = filterConfig[FILTER_CONFIG_ATTRIBUTES.DEFAULT_VALUE];
      }
    }

    return (
      <OnPasteSelect
        cacheOptions
        loadOptions={this.debounceLoadOptions(key)}
        defaultOptions={this.transformOptions(data)}
        key={key}
        placeholder={t('Type or Select [%s]', label)}
        isMulti={filterConfig[FILTER_CONFIG_ATTRIBUTES.MULTIPLE]}
        isClearable={filterConfig[FILTER_CONFIG_ATTRIBUTES.CLEARABLE]}
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
          filterConfig[FILTER_CONFIG_ATTRIBUTES.SEARCH_ALL_OPTIONS] &&
          data.length >= FILTER_OPTIONS_LIMIT
            ? AsyncCreatableSelect
            : CreatableSelect
        }
        noResultsText={t('No results found')}
      />
    );
  }

  renderFilters() {
    const { filtersFields = [] } = this.props;
    return filtersFields.map(filterConfig => {
      const { label, key } = filterConfig;
      return (
        <div key={key} className="m-b-5 filter-container">
          <FormLabel htmlFor={`LABEL-${key}`}>{label}</FormLabel>
          {this.renderSelect(filterConfig)}
        </div>
      );
    });
  }

  render() {
    const { instantFiltering } = this.props;
    return (
      <Styles>
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
      </Styles>
    );
  }
}

FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

export default FilterBox;
