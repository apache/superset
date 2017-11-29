// JS
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import VirtualizedSelect from 'react-virtualized-select';
import { Creatable } from 'react-select';
import { Button } from 'react-bootstrap';

import DateFilterControl from '../javascripts/explore/components/controls/DateFilterControl';
import ControlRow from '../javascripts/explore/components/ControlRow';
import Control from '../javascripts/explore/components/Control';
import controls from '../javascripts/explore/stores/controls';
import OnPasteSelect from '../javascripts/components/OnPasteSelect';
import VirtualizedRendererWrap from '../javascripts/components/VirtualizedRendererWrap';
import './filter_box.css';
import { t } from '../javascripts/locales';

// maps control names to their key in extra_filters
const timeFilterMap = {
  since: '__from',
  until: '__to',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};
const propTypes = {
  origSelectedValues: PropTypes.object,
  instantFiltering: PropTypes.bool,
  filtersChoices: PropTypes.object,
  onChange: PropTypes.func,
  showDateFilter: PropTypes.bool,
  showSqlaTimeGrain: PropTypes.bool,
  showSqlaTimeColumn: PropTypes.bool,
  showDruidTimeGrain: PropTypes.bool,
  showDruidTimeOrigin: PropTypes.bool,
  datasource: PropTypes.object.isRequired,
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
      hasChanged: false,
    };
  }
  getControlData(controlName) {
    const control = Object.assign({}, controls[controlName]);
    const controlData = {
      name: controlName,
      key: `control-${controlName}`,
      value: this.state.selectedValues[timeFilterMap[controlName]],
      actions: { setControlValue: this.changeFilter.bind(this) },
    };
    Object.assign(control, controlData);
    const mapFunc = control.mapStateToProps;
    if (mapFunc) {
      return Object.assign({}, control, mapFunc(this.props));
    }
    return control;
  }
  clickApply() {
    const { selectedValues } = this.state;
    Object.keys(selectedValues).forEach((fltr, i, arr) => {
      let refresh = false;
      if (i === arr.length - 1) {
        refresh = true;
      }
      this.props.onChange(fltr, selectedValues[fltr], false, refresh);
    });
    this.setState({ hasChanged: false });
  }
  changeFilter(filter, options) {
    const fltr = timeFilterMap[filter] || filter;
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
    const selectedValues = Object.assign({}, this.state.selectedValues);
    selectedValues[fltr] = vals;
    this.setState({ selectedValues, hasChanged: true });
    if (this.props.instantFiltering) {
      this.props.onChange(fltr, vals, false, true);
    }
  }
  render() {
    let dateFilter;
    const since = '__from';
    const until = '__to';
    if (this.props.showDateFilter) {
      dateFilter = (
        <div className="row space-1">
          <div className="col-lg-6 col-xs-12">
            <DateFilterControl
              name={since}
              label="Since"
              description="Select starting date"
              onChange={this.changeFilter.bind(this, since)}
              value={this.state.selectedValues[since]}
            />
          </div>
          <div className="col-lg-6 col-xs-12">
            <DateFilterControl
              name={until}
              label="Until"
              description="Select end date"
              onChange={this.changeFilter.bind(this, until)}
              value={this.state.selectedValues[until]}
            />
          </div>
        </div>
      );
    }
    const datasourceFilters = [];
    const sqlaFilters = [];
    const druidFilters = [];
    if (this.props.showSqlaTimeGrain) sqlaFilters.push('time_grain_sqla');
    if (this.props.showSqlaTimeColumn) sqlaFilters.push('granularity_sqla');
    if (this.props.showDruidTimeGrain) druidFilters.push('granularity');
    if (this.props.showDruidTimeOrigin) druidFilters.push('druid_time_origin');
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
    // Add created options to filtersChoices, even though it doesn't exist,
    // or these options will exist in query sql but invisible to end user.
    for (const filterKey in this.state.selectedValues) {
      if (
        !this.state.selectedValues.hasOwnProperty(filterKey) ||
        !(filterKey in this.props.filtersChoices)
      ) {
        continue;
      }
      const existValues = this.props.filtersChoices[filterKey].map(f => f.id);
      for (const v of this.state.selectedValues[filterKey]) {
        if (existValues.indexOf(v) === -1) {
          const addChoice = {
            filter: filterKey,
            id: v,
            text: v,
            metric: 0,
          };
          this.props.filtersChoices[filterKey].unshift(addChoice);
        }
      }
    }
    const filters = Object.keys(this.props.filtersChoices).map((filter) => {
      const data = this.props.filtersChoices[filter];
      const maxes = {};
      maxes[filter] = d3.max(data, function (d) {
        return d.metric;
      });
      return (
        <div key={filter} className="m-b-5">
          {this.props.datasource.verbose_map[filter] || filter}
          <OnPasteSelect
            placeholder={t('Select [%s]', filter)}
            key={filter}
            multi
            value={this.state.selectedValues[filter]}
            options={data.map((opt) => {
              const perc = Math.round((opt.metric / maxes[opt.filter]) * 100);
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
            onChange={this.changeFilter.bind(this, filter)}
            selectComponent={Creatable}
            selectWrap={VirtualizedSelect}
            optionRenderer={VirtualizedRendererWrap(opt => opt.label)}
          />
        </div>
      );
    });
    return (
      <div className="scrollbar-container">
        <div className="scrollbar-content">
          {dateFilter}
          {datasourceFilters}
          {filters}
          {!this.props.instantFiltering &&
            <Button
              bsSize="small"
              bsStyle="primary"
              onClick={this.clickApply.bind(this)}
              disabled={!this.state.hasChanged}
            >
              Apply
            </Button>
          }
        </div>
      </div>
    );
  }
}
FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

function filterBox(slice, payload) {
  const d3token = d3.select(slice.selector);
  d3token.selectAll('*').remove();

  // filter box should ignore the dashboard's filters
  // const url = slice.jsonEndpoint({ extraFilters: false });
  const fd = slice.formData;
  const filtersChoices = {};
  // Making sure the ordering of the fields matches the setting in the
  // dropdown as it may have been shuffled while serialized to json
  fd.groupby.forEach((f) => {
    filtersChoices[f] = payload.data[f];
  });
  ReactDOM.render(
    <FilterBox
      filtersChoices={filtersChoices}
      onChange={slice.addFilter}
      showDateFilter={fd.date_filter}
      showSqlaTimeGrain={fd.show_sqla_time_granularity}
      showSqlaTimeColumn={fd.show_sqla_time_column}
      showDruidTimeGrain={fd.show_druid_time_granularity}
      showDruidTimeOrigin={fd.show_druid_time_origin}
      datasource={slice.datasource}
      origSelectedValues={slice.getFilters() || {}}
      instantFiltering={fd.instant_filtering}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = filterBox;
