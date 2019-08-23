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
import { Creatable } from 'react-select';
import { Button } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import DateFilterControl from '../../explore/components/controls/DateFilterControl';
import ControlRow from '../../explore/components/ControlRow';
import Control from '../../explore/components/Control';
import controls from '../../explore/controls';
import OnPasteSelect from '../../components/OnPasteSelect';
import VirtualizedRendererWrap from '../../components/VirtualizedRendererWrap';
import { getFilterColorKey, getFilterColorMap } from '../../dashboard/util/dashboardFiltersColorMap';
import FilterBadgeIcon from '../../components/FilterBadgeIcon';

import './FilterBox.css';

// maps control names to their key in extra_filters
const TIME_FILTER_MAP = {
  time_range: '__time_range',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};

export const TIME_RANGE = '__time_range';
export const FILTER_LABELS = {
  [TIME_RANGE]: 'Time range',
};

const propTypes = {
  chartId: PropTypes.number.isRequired,
  origSelectedValues: PropTypes.object,
  datasource: PropTypes.object.isRequired,
  instantFiltering: PropTypes.bool,
  filtersFields: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string,
    label: PropTypes.string,
  })),
  filtersChoices: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    text: PropTypes.string,
    filter: PropTypes.string,
    metric: PropTypes.number,
  }))),
  onChange: PropTypes.func,
  showDateFilter: PropTypes.bool,
  showSqlaTimeGrain: PropTypes.bool,
  showSqlaTimeColumn: PropTypes.bool,
  showDruidTimeGrain: PropTypes.bool,
  showDruidTimeOrigin: PropTypes.bool,
};
const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  showDateFilter: false,
  showSqlaTimeGrain: false,
  showSqlaTimeColumn: false,
  showDruidTimeGrain: false,
  showDruidTimeOrigin: false,
  instantFiltering: true,
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
  }

  getControlData(controlName) {
    const { selectedValues } = this.state;
    const control = Object.assign({}, controls[controlName], {
      name: controlName,
      key: `control-${controlName}`,
      value: selectedValues[TIME_FILTER_MAP[controlName]],
      actions: { setControlValue: this.changeFilter },
    });
    const mapFunc = control.mapStateToProps;
    return mapFunc
      ? Object.assign({}, control, mapFunc(this.props))
      : control;
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
    const label = t(FILTER_LABELS[TIME_RANGE]);
    if (showDateFilter) {
      return (
        <div className="row space-1">
          <div className="col-lg-12 col-xs-12 filter-container">
            {this.renderFilterBadge(chartId, TIME_RANGE, label)}
            <DateFilterControl
              name={TIME_RANGE}
              label={label}
              description={t('Select start and end date')}
              onChange={(...args) => { this.changeFilter(TIME_RANGE, ...args); }}
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
      .filter(key => selectedValues.hasOwnProperty(key) && (key in filtersChoices))
      .forEach((key) => {
        const choices = filtersChoices[key] || [];
        const choiceIds = new Set(choices.map(f => f.id));
        const selectedValuesForKey = Array.isArray(selectedValues[key])
          ? selectedValues[key]
          : [selectedValues[key]];
        selectedValuesForKey
          .filter(value => !choiceIds.has(value))
          .forEach((value) => {
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
    if (!value && filterConfig.defaultValue) {
      if (filterConfig.multiple) {
        // Support for semicolon-delimited multiple values
        value = filterConfig.defaultValue.split(';');
      } else {
        value = filterConfig.defaultValue;
      }
    }
    return (
      <OnPasteSelect
        placeholder={t('Select [%s]', label)}
        key={key}
        multi={filterConfig.multiple}
        clearable={filterConfig.clearable}
        value={value}
        options={data.map((opt) => {
          const perc = Math.round((opt.metric / max) * 100);
          const backgroundImage = (
            'linear-gradient(to right, lightgrey, ' +
            `lightgrey ${perc}%, rgba(0,0,0,0) ${perc}%`
          );
          const style = {
            backgroundImage,
            padding: '2px 5px',
          };
          return { value: opt.id, label: opt.id, style };
        })}
        onChange={(...args) => { this.changeFilter(key, ...args); }}
        selectComponent={Creatable}
        selectWrap={VirtualizedSelect}
        optionRenderer={VirtualizedRendererWrap(opt => opt.label)}
        noResultsText={t('No results found')}
      />);
  }

  renderFilters() {
    const { filtersFields, chartId } = this.props;
    return filtersFields.map((filterConfig) => {
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
    const colorKey = getFilterColorKey(chartId, column);
    const filterColorMap = getFilterColorMap();
    const colorCode = filterColorMap[colorKey];

    return (
      <div className="filter-badge-container">
        <FilterBadgeIcon
          colorCode={colorCode}
        />
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
          {!instantFiltering &&
            <Button
              bsSize="small"
              bsStyle="primary"
              onClick={this.clickApply.bind(this)}
              disabled={!this.state.hasChanged}
            >
              {t('Apply')}
            </Button>
          }
        </div>
      </div>
    );
  }
}

FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

export default FilterBox;
