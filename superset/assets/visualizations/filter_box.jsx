// JS
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import Select from 'react-select';
import { Button } from 'react-bootstrap';

import DateFilterControl from '../javascripts/explore/components/controls/DateFilterControl';
import './filter_box.css';

const propTypes = {
  origSelectedValues: PropTypes.object,
  instantFiltering: PropTypes.bool,
  filtersChoices: PropTypes.object,
  onChange: PropTypes.func,
  showDateFilter: PropTypes.bool,
  datasource: PropTypes.object.isRequired,
};
const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  showDateFilter: false,
  instantFiltering: true,
};

class FilterBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValues: props.origSelectedValues,
      hasChanged: false,
      timeColumnOptions: props.datasource.granularity_sqla,
      timeGrainOptions: props.datasource.time_grain_sqla,
    };
  }
  clickApply() {
    this.props.onChange(Object.keys(this.state.selectedValues)[0], [], true, true);
    this.setState({ hasChanged: false });
  }
  changeFilter(filter, options) {
    let vals = null;
    if (options) {
      if (Array.isArray(options)) {
        vals = options.map(opt => opt.value);
      } else if (options.value) {
        vals = options.value;
      } else {
        vals = options;
      }
    }
    const selectedValues = Object.assign({}, this.state.selectedValues);
    selectedValues[filter] = vals;
    this.setState({ selectedValues, hasChanged: true });
    this.props.onChange(filter, vals, false, this.props.instantFiltering);
  }
  newColumnOption(option) {
    const newColumnOptions = this.state.timeColumnOptions.slice();
    newColumnOptions.push(option.value);
    this.setState({ timeColumnOptions: newColumnOptions });
  }
  newGrainOption(option) {
    const newGrainOptions = this.state.timeGrainOptions.slice();
    newGrainOptions.push(option.value);
    this.setState({ timeGrainOptions: newGrainOptions });
  }
  render() {
    let dateFilter;
    let timeColumnFilter;
    let timeGrainFilter;
    const since = '__from';
    const until = '__to';
    const timeCol = '__time_col';
    const timeGrain = '__time_grain';
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
      timeColumnFilter = (
        <div className="m-b-5">
          Time Column
          <Select.Creatable
            placeholder={`Select (${this.state.timeColumnOptions.length})`}
            key={timeCol}
            options={this.state.timeColumnOptions.map(option =>
              ({ value: option[0], label: option[0] }),
            )}
            onChange={this.changeFilter.bind(this, timeCol)}
            value={this.state.selectedValues[timeCol]}
            onNewOptionClick={this.newColumnOption.bind(this)}
          />
        </div>
      );
      timeGrainFilter = (
        <div className="m-b-5">
          Time Grain
          <Select.Creatable
            placeholder={`Select (${this.state.timeGrainOptions.length})`}
            key={timeGrain}
            options={this.state.timeGrainOptions.map(option =>
              ({ value: option[0], label: option[0] }),
            )}
            onChange={this.changeFilter.bind(this, timeGrain)}
            value={this.state.selectedValues[timeGrain]}
            onNewOptionClick={this.newGrainOption.bind(this)}
          />
        </div>
      );
    }
    // Add created options to filtersChoices, even though it doesn't exist,
    // or these options will exist in query sql but invisible to end user.
    if (this.state.selectedValues.hasOwnProperty()) {
      for (const filterKey of this.state.selectedValues) {
        const existValues = this.props.filtersChoices[filterKey].map(f => f.id);
        for (const v of this.state.selectedValues[filterKey]) {
          if (existValues.indexOf(v) === -1) {
            const addChoice = {
              filter: filterKey,
              id: v,
              text: v,
              metric: 0,
            };
            this.props.filtersChoices[filterKey].push(addChoice);
          }
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
          <Select.Creatable
            placeholder={`Select [${filter}]`}
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
          />
        </div>
      );
    });
    return (
      <div>
        {dateFilter}
        {timeColumnFilter}
        {timeGrainFilter}
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
      datasource={slice.datasource}
      origSelectedValues={slice.getFilters() || {}}
      instantFiltering={fd.instant_filtering}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = filterBox;
