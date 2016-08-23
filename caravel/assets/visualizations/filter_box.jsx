// JS
const $ = require('jquery');
import d3 from 'd3';

import React from 'react';
import ReactDOM from 'react-dom';

import Select from 'react-select';
import '../stylesheets/react-select/select.less';

import './filter_box.css';

class FilterBox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedValues: props.origSelectedValues,
    };
  }
  render() {
    const filters = Object.keys(this.props.filtersChoices).map((filter) => {
      const data = this.props.filtersChoices[filter];
      const maxes = {};
      maxes[filter] = d3.max(data, function (d) {
        return d.metric;
      });
      return (
        <div>
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
            onChange={(selectedOptions) => {
              let vals;
              if (selectedOptions) {
                vals = selectedOptions.map((opt) => opt.value);
              } else {
                vals = null;
              }
              const selectedValues = this.state.selectedValues;
              selectedValues[filter] = vals;
              this.setState({ selectedValues });
              this.props.onChange(filter, vals);
            }}
          />
        </div>
      );
    });
    return (
      <div>
        {filters}
      </div>
    );
  }
}
FilterBox.propTypes = {
  origSelectedValues: React.PropTypes.objectOf(React.PropTypes.array),
  filtersChoices: React.PropTypes.objectOf(React.PropTypes.array),
  onChange: React.PropTypes.function,
};
FilterBox.defaultProps = {
  origSelectedValues: {},
  onChange() {},
};

function filterBox(slice) {
  const d3token = d3.select(slice.selector);

  const refresh = function () {
    d3token.selectAll('*').remove();

    // filter box should ignore the dashboard's filters
    const url = slice.jsonEndpoint({ extraFilters: false });
    $.getJSON(url, (payload) => {
      ReactDOM.render(
        <FilterBox
          filtersChoices={payload.data}
          onChange={slice.setFilter}
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
