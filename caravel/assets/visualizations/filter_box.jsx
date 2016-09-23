// JS
const $ = require('jquery');
import d3 from 'd3';

import React from 'react';
import ReactDOM from 'react-dom';

import Select from 'react-select';
import '../stylesheets/react-select/select.less';

import './filter_box.css';
import { TIME_CHOICES } from './constants.js';

const propTypes = {
  origSelectedValues: React.PropTypes.object,
  filtersChoices: React.PropTypes.object,
  onChange: React.PropTypes.func,
  showDateFilter: React.PropTypes.bool,
};

const defaultProps = {
  origSelectedValues: {},
  onChange: () => {},
  showDateFilter: false,
};

class FilterBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValues: props.origSelectedValues,
    };
  }
  changeFilter(filter, options) {
    let vals = null;
    if (options) {
      if (Array.isArray(options)) {
        vals = options.map((opt) => opt.value);
      } else {
        vals = options.value;
      }
    }
    const selectedValues = Object.assign({}, this.state.selectedValues);
    selectedValues[filter] = vals;
    this.setState({ selectedValues });
    this.props.onChange(filter, vals);
  }
  render() {
    let dateFilter;
    if (this.props.showDateFilter) {
      dateFilter = ['__from', '__to'].map((field) => {
        const val = this.state.selectedValues[field];
        const choices = TIME_CHOICES.slice();
        if (!choices.includes(val)) {
          choices.push(val);
        }
        const options = choices.map((s) => ({ value: s, label: s }));
        return (
          <div className="m-b-5">
            {field.replace('__', '')}
            <Select.Creatable
              options={options}
              value={this.state.selectedValues[field]}
              onChange={this.changeFilter.bind(this, field)}
            />
          </div>
        );
      });
    }
    const filters = Object.keys(this.props.filtersChoices).map((filter) => {
      const data = this.props.filtersChoices[filter];
      const maxes = {};
      maxes[filter] = d3.max(data, function (d) {
        return d.metric;
      });
      return (
        <div key={filter} className="m-b-5">
          {filter}
          <Select
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
        {filters}
      </div>
    );
  }
}
FilterBox.propTypes = propTypes;
FilterBox.defaultProps = defaultProps;

function filterBox(slice) {
  const d3token = d3.select(slice.selector);

  const refresh = function () {
    d3token.selectAll('*').remove();

    // filter box should ignore the dashboard's filters
    const url = slice.jsonEndpoint({ extraFilters: false });
    $.getJSON(url, (payload) => {
      const fd = payload.form_data;
      const filtersChoices = {};
      // Making sure the ordering of the fields matches the setting in the
      // dropdown as it may have been shuffled while serialized to json
      payload.form_data.groupby.forEach((f) => {
        filtersChoices[f] = payload.data[f];
      });
      ReactDOM.render(
        <FilterBox
          filtersChoices={filtersChoices}
          onChange={slice.setFilter}
          showDateFilter={fd.date_filter}
          origSelectedValues={slice.getFilters() || {}}
        />,
        document.getElementById(slice.containerId)
      );
      slice.done(payload);
    })
    .fail(function (xhr) {
      slice.error(xhr.responseText, xhr);
    });
  };
  return {
    render: refresh,
    resize: () => {},
  };
}

module.exports = filterBox;
