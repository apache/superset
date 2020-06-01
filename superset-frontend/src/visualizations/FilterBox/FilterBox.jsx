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
import { CreatableSelect } from 'src/components/Select';
import { Button } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import DateFilterControl from '../../explore/components/controls/DateFilterControl';
import ControlRow from '../../explore/components/ControlRow';
import Control from '../../explore/components/Control';
import controls from '../../explore/controls';
import OnPasteSelect from '../../components/Select/OnPasteSelect';
import { getDashboardFilterKey } from '../../dashboard/util/getDashboardFilterKey';
import { getFilterColorMap } from '../../dashboard/util/dashboardFiltersColorMap';
import {
  FILTER_CONFIG_ATTRIBUTES,
  TIME_FILTER_LABELS,
} from '../../explore/constants';
import FilterBadgeIcon from '../../components/FilterBadgeIcon';

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

class FilterBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValues: props.origSelectedValues,
      // this flag is used by non-instant filter, to make the apply button enabled/disabled
      hasChanged: false,
    };
    this.changeFilter = this.changeFilter.bind(this);
    this.onFilterMenuOpen = this.onFilterMenuOpen.bind(this);
    this.onOpenDateFilterControl = this.onOpenDateFilterControl.bind(this);
    this.onFilterMenuClose = this.onFilterMenuClose.bind(this);
  }

  onFilterMenuOpen(column) {
    return this.props.onFilterMenuOpen(this.props.chartId, column);
  }

  onOpenDateFilterControl() {
    return this.onFilterMenuOpen(TIME_RANGE);
  }

  onFilterMenuClose() {
    return this.props.onFilterMenuClose(this.props.chartId);
  }

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
        vals = options.map(opt => opt.value);
      } else if (options.value) {
        vals = options.value;
      } else {
        vals = options;
      }
    }
    const selectedValues = {
      ...this.state.selectedValues,
      [fltr]: vals,
    };

    this.setState({ selectedValues, hasChanged: true }, () => {
      if (this.props.instantFiltering) {
        this.props.onChange({ [fltr]: vals }, false);
      }
    });
  }

  renderDateFilter() {
    const { showDateFilter, chartId } = this.props;
    const label = TIME_FILTER_LABELS.time_range;
    if (showDateFilter) {
      return (
        <div className="row space-1">
          <div className="col-lg-12 col-xs-12 filter-container">
            {this.renderFilterBadge(chartId, TIME_RANGE, label)}
            <DateFilterControl
              name={TIME_RANGE}
              label={label}
              description={t('Select start and end date')}
              onChange={newValue => {
                this.changeFilter(TIME_RANGE, newValue);
              }}
              onOpenDateFilterControl={this.onOpenDateFilterControl}
              onCloseDateFilterControl={this.onFilterMenuClose}
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

    // Add created options to filtersChoices, even though it doesn't exist,
    // or these options will exist in query sql but invisible to end user.
    Object.keys(selectedValues)
      .filter(
        key => selectedValues.hasOwnProperty(key) && key in filtersChoices,
      )
      .forEach(key => {
        const choices = filtersChoices[key] || [];
        const choiceIds = new Set(choices.map(f => f.id));
        const selectedValuesForKey = Array.isArray(selectedValues[key])
          ? selectedValues[key]
          : [selectedValues[key]];
        selectedValuesForKey
          .filter(value => !choiceIds.has(value))
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
    const data = this.props.filtersChoices[key];
    const max = Math.max(...data.map(d => d.metric));
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
        key={key}
        placeholder={t('Select [%s]', label)}
        isMulti={filterConfig[FILTER_CONFIG_ATTRIBUTES.MULTIPLE]}
        isClearable={filterConfig.clearable}
        value={value}
        options={data
          .filter(opt => opt.id !== null)
          .map(opt => {
            const perc = Math.round((opt.metric / max) * 100);
            const color = 'lightgrey';
            const backgroundImage = `linear-gradient(to right, ${color}, ${color} ${perc}%, rgba(0,0,0,0) ${perc}%`;
            const style = { backgroundImage };
            return { value: opt.id, label: opt.id, style };
          })}
        onChange={newValue => {
          // avoid excessive re-renders
          if (newValue !== value) {
            this.changeFilter(key, newValue);
          }
        }}
        onFocus={() => this.onFilterMenuOpen(key)}
        onMenuOpen={() => this.onFilterMenuOpen(key)}
        onBlur={this.onFilterMenuClose}
        onMenuClose={this.onFilterMenuClose}
        selectWrap={CreatableSelect}
        noResultsText={t('No results found')}
      />
    );
  }

  renderFilters() {
    const { filtersFields, chartId } = this.props;
    return filtersFields.map(filterConfig => {
      const { label, key } = filterConfig;
      return (
        <div key={key} className="m-b-5 filter-container">
          {this.renderFilterBadge(chartId, key, label)}
          <div>
            <label htmlFor={`LABEL-${key}`}>{label}</label>
            {this.renderSelect(filterConfig)}
          </div>
        </div>
      );
    });
  }

  renderFilterBadge(chartId, column) {
    const colorKey = getDashboardFilterKey({ chartId, column });
    const filterColorMap = getFilterColorMap();
    const colorCode = filterColorMap[colorKey];

    return (
      <div className="filter-badge-container">
        <FilterBadgeIcon colorCode={colorCode} />
      </div>
    );
  }

  render() {
    const { instantFiltering } = this.props;

    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {this.renderDateFilter()}
          {this.renderDatasourceFilters()}
          {this.renderFilters()}
          {!instantFiltering && (
            <Button
              bsSize="small"
              bsStyle="primary"
              onClick={this.clickApply.bind(this)}
              disabled={!this.state.hasChanged}
            >
              {t('Apply')}
            </Button>
          )}
        </div>
      </div>
    );
  }
}

FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

export default FilterBox;
