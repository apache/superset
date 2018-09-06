import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import VirtualizedSelect from 'react-virtualized-select';
import { Creatable } from 'react-select';
import { Button } from 'react-bootstrap';

import DateFilterControl from '../explore/components/controls/DateFilterControl';
import ControlRow from '../explore/components/ControlRow';
import Control from '../explore/components/Control';
import controls from '../explore/controls';
import OnPasteSelect from '../components/OnPasteSelect';
import VirtualizedRendererWrap from '../components/VirtualizedRendererWrap';
import { t } from '../locales';
import './filter_box.css';

// maps control names to their key in extra_filters
const TIME_FILTER_MAP = {
  time_range: '__time_range',
  granularity_sqla: '__time_col',
  time_grain_sqla: '__time_grain',
  druid_time_origin: '__time_origin',
  granularity: '__granularity',
};

const TIME_RANGE = '__time_range';

const propTypes = {
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
    const selectedValues = Object.assign({}, this.state.selectedValues);
    selectedValues[fltr] = vals;
    this.setState({ selectedValues, hasChanged: true });
    if (this.props.instantFiltering) {
      this.props.onChange(fltr, vals, false, true);
    }
  }

  renderDateFilter() {
    const { showDateFilter } = this.props;
    if (showDateFilter) {
      return (
        <div className="row space-1">
          <div className="col-lg-12 col-xs-12">
            <DateFilterControl
              name={TIME_RANGE}
              label={t('Time range')}
              description={t('Select start and end date')}
              onChange={(...args) => { this.changeFilter(TIME_RANGE, ...args); }}
              value={this.state.selectedValues[TIME_RANGE]}
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

  renderFilters() {
    const { filtersFields, filtersChoices } = this.props;
    const { selectedValues } = this.state;

    // Add created options to filtersChoices, even though it doesn't exist,
    // or these options will exist in query sql but invisible to end user.
    Object.keys(selectedValues)
      .filter(key => !selectedValues.hasOwnProperty(key)
        || !(key in filtersChoices))
      .forEach((key) => {
        const choices = filtersChoices[key];
        const choiceIds = new Set(choices.map(f => f.id));
        selectedValues[key]
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

    return filtersFields.map(({ key, label }) => {
      const data = filtersChoices[key];
      const max = Math.max(...data.map(d => d.metric));
      return (
        <div key={key} className="m-b-5">
          {label}
          <OnPasteSelect
            placeholder={t('Select [%s]', label)}
            key={key}
            multi
            value={selectedValues[key]}
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
          />
        </div>
      );
    });
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

function adaptor(slice, payload) {
  // filter box should ignore the dashboard's filters
  // const url = slice.jsonEndpoint({ extraFilters: false });
  const { formData, datasource } = slice;
  const { verbose_map: verboseMap } = datasource;
  const {
    groupby,
    instant_filtering: instantFiltering,
    date_filter: showDateFilter,
    show_sqla_time_granularity: showSqlaTimeGrain,
    show_sqla_time_column: showSqlaTimeColumn,
    show_druid_time_granularity: showDruidTimeGrain,
    show_druid_time_origin: showDruidTimeOrigin,
  } = formData;

  const filtersFields = groupby.map(key => ({
    key,
    label: verboseMap[key] || key,
  }));

  ReactDOM.render(
    <FilterBox
      datasource={datasource}
      filtersFields={filtersFields}
      filtersChoices={payload.data}
      onChange={slice.addFilter}
      showDateFilter={showDateFilter}
      showSqlaTimeGrain={showSqlaTimeGrain}
      showSqlaTimeColumn={showSqlaTimeColumn}
      showDruidTimeGrain={showDruidTimeGrain}
      showDruidTimeOrigin={showDruidTimeOrigin}
      origSelectedValues={slice.getFilters() || {}}
      instantFiltering={instantFiltering}
    />,
    document.getElementById(slice.containerId),
  );
}

export default adaptor;
