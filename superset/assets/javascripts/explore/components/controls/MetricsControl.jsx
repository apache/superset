import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';
import Select, { Creatable } from 'react-select';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';
import MetricDefinitionOption from '../MetricDefinitionOption';
import MetricDefinitionValue from '../MetricDefinitionValue';
import AdhocMetric from '../../AdhocMetric';
import columnType from '../../propTypes/columnType';
import savedMetricType from '../../propTypes/savedMetricType';
import adhocMetricType from '../../propTypes/adhocMetricType';
import { AGGREGATES } from '../../constants';

const propTypes = {
  multi: PropTypes.bool,
  name: PropTypes.string.isRequired, 
  onChange: PropTypes.func,
  value: PropTypes.arrayOf(PropTypes.oneOfType([ PropTypes.string, adhocMetricType, ])),
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
};

const defaultProps = {
  onChange: () => {},
};

function isDictionaryForAdhocMetric(value) {
  return value && !(value instanceof AdhocMetric) && value.column && value.aggregate && value.label;
}

// adhoc metrics are stored as dictionaries in URL params. When we reload the page we want to convert them
// back into the AdhocMetric class for typechecking, consistency and instance method access.
function coerceAdhocMetrics(values) {
  if (!values) {
    return [];
  }
  return values.map(value => {
    if (isDictionaryForAdhocMetric(value)) {
      return new AdhocMetric(value);
    } else {
      return value
    }
  });
}

function getDefaultAggregateForColumn(column) {
  const type = column.type;
  if (type === '' || type === 'expression') {
    return AGGREGATES.SUM;
  } else if (type.match(/.*char.*/i) || type.match(/string.*/i) || type.match(/.*text.*/i)) {
    return AGGREGATES.COUNT_DISTINCT;
  } else if (type.match(/.*int.*/i) || type === 'LONG' || type === 'DOUBLE' || type === 'FLOAT') {
    return AGGREGATES.SUM;
  } else if (type.match(/.*bool.*/i)) {
    return AGGREGATES.MAX;
  } else if (type.match(/.*time.*/i)) {
    return AGGREGATES.COUNT;
  } else if (type.match(/unknown/i)) {
    return AGGREGATES.COUNT;
  }
}

function selectFilterOption(option, filterValue) {
  let endIndex = filterValue.length;
  if (filterValue.endsWith(')')) {
    endIndex = filterValue.length - 1;
  }
  const valueAfterAggregate = filterValue.substring(filterValue.indexOf('(') + 1, endIndex);
  return option.column_name && (option.column_name.indexOf(valueAfterAggregate) >= 0);
}

export default class MetricsControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onChange = this.onChange.bind(this);
    this.onMetricEdit = this.onMetricEdit.bind(this);
    this.checkIfAggregateInInput = this.checkIfAggregateInInput.bind(this);
    this.optionsForSelect = this.optionsForSelect.bind(this);
    this.state = {
      aggregateInInput: null,
      options: this.optionsForSelect(this.props),
      value: coerceAdhocMetrics(this.props.value),
    };
  }

  componentDidUpdate(previousProps) {
    if ( this.props.columns !== previousProps.columns || this.props.savedMetrics !== previousProps.savedMetrics) {
      console.log('updating options for select');
      this.setState({ options: this.optionsForSelect() });
    }
    if (this.props.value !== previousProps.value) {
      console.log('coercing adhocMetrics');
      this.setState({ value: coerceAdhocMetrics(this.props.value) });
    }
  }

  optionsForSelect() {
    const options = [
      ...this.props.columns,
      ...Object.keys(AGGREGATES).map(aggregate => ({ aggregate_name: aggregate })),
      ...this.props.savedMetrics,
    ];

    return options.map((option) => {
      if (option.metric_name) {
        return { ...option, optionName: option.metric_name };
      } else if (option.column_name) {
        return { ...option, optionName: '_col_' + option.column_name };
      } else if (option.aggregate_name) {
        return { ...option, optionName: '_aggregate_' + option.aggregate_name };
      }
    });
  }

  onMetricEdit(changedMetric) {
    this.props.onChange(this.state.value.map((value) => {
      if (value.optionName === changedMetric.optionName) {
        return changedMetric;
      }
      return value;
    }));
  }

  checkIfAggregateInInput(input) {
    let nextState = { aggregateInInput: null };
    Object.keys(AGGREGATES).forEach(aggregate => {
      if (input.toLowerCase().startsWith(aggregate.toLowerCase() + '(')) {
        nextState = { aggregateInInput: aggregate };
      }
    });
    this.clearedAggregateInInput = this.state.aggregateInInput;
    this.setState(nextState);
  }

  onChange(opts) {
    const optionValues = opts.map((option) => {
      if (option.metric_name) {
        return option.metric_name;
      } else if (option.column_name) {
        const clearedAggregate = this.clearedAggregateInInput;
        this.clearedAggregateInInput = null;
        return new AdhocMetric({ 
          column: option, 
          aggregate: clearedAggregate || getDefaultAggregateForColumn(option),
        });
      } else if (option instanceof AdhocMetric) {
        return option;
      } else if (option.aggregate_name) {
        const newValue = `${option.aggregate_name}()`;
        this.select.setInputValue(newValue);
        this.select.handleInputChange({ target: { value: newValue }});
        // we need to set a timeout here or the selectionWill be overwritten by some browsers (e.g. Chrome)
        setTimeout(() => {
          this.select.input.input.selectionStart = newValue.length - 1;
          this.select.input.input.selectionEnd = newValue.length - 1;
        }, 0);
      }
    }).filter(option => option);
    this.props.onChange(optionValues);
  }

  render() {
    // TODO figure out why the dropdown isnt appearing as soon as a metric is selected
    return (
      <div className="metrics-select">
        <ControlHeader {...this.props} />
        <OnPasteSelect 
          multi={this.props.multi}
          name={`select-${this.props.name}`}
          placeholder={t('%s option(s)', this.state.options.length)}
          options={this.state.options}
          value={this.state.value}
          labelKey="label"
          valueKey={this.props.valueKey}
          clearable
          closeOnSelect={true}
          onChange={this.onChange}
          optionRenderer={VirtualizedRendererWrap((option) => (
            <MetricDefinitionOption option={option} />
          ))}
          valueRenderer={(option) => (
            <MetricDefinitionValue
              option={option}
              onMetricEdit={this.onMetricEdit}
              columns={this.props.columns}
            />
          )}
          onInputChange={this.checkIfAggregateInInput}
          filterOption={this.state.aggregateInInput ? selectFilterOption : null}
          refFunc={(ref) => ref && (this.select = ref._selectRef)}
          selectWrap={VirtualizedSelect} 
        />
      </div>
    );
  }
}

MetricsControl.propTypes = propTypes;
MetricsControl.defaultProps = defaultProps;
