import React from 'react';
import PropTypes from 'prop-types';
import VirtualizedSelect from 'react-virtualized-select';

import { t } from '../../../locales';
import ControlHeader from '../ControlHeader';
import adhocFilterType from '../../propTypes/adhocFilterType';
import adhocMetricType from '../../propTypes/adhocMetricType';
import savedMetricType from '../../propTypes/savedMetricType';
import columnType from '../../propTypes/columnType';
import AdhocFilter, { CLAUSES, EXPRESSION_TYPES } from '../../AdhocFilter';
import AdhocMetric from '../../AdhocMetric';
import { OPERATORS } from '../../constants';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';
import AdhocFilterOption from '../AdhocFilterOption';
import FilterDefinitionOption from '../FilterDefinitionOption';

const legacyFilterShape = PropTypes.shape({
  col: PropTypes.string,
  op: PropTypes.string,
  val: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
});

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.arrayOf(adhocFilterType),
  datasource: PropTypes.object,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  formData: PropTypes.shape({
    filters: PropTypes.arrayOf(legacyFilterShape),
    having: PropTypes.string,
    having_filters: PropTypes.arrayOf(legacyFilterShape),
    metric: PropTypes.oneOfType([PropTypes.string, adhocMetricType]),
    metrics: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, adhocMetricType])),
    where: PropTypes.string,
  }),
};

const defaultProps = {
  name: '',
  onChange: () => {},
  columns: [],
  savedMetrics: [],
  formData: {},
};

function isDictionaryForAdhocFilter(value) {
  return value && !(value instanceof AdhocFilter) && value.expressionType;
}

export default class AdhocFilterControl extends React.Component {

  constructor(props) {
    super(props);
    this.coerceAdhocFilters = this.coerceAdhocFilters.bind(this);
    this.optionsForSelect = this.optionsForSelect.bind(this);
    this.onFilterEdit = this.onFilterEdit.bind(this);
    this.onChange = this.onChange.bind(this);
    this.getMetricExpression = this.getMetricExpression.bind(this);

    const filters = this.coerceAdhocFilters(this.props.value, this.props.formData);
    this.optionRenderer = VirtualizedRendererWrap(option => (
      <FilterDefinitionOption option={option} />
    ));
    this.valueRenderer = adhocFilter => (
      <AdhocFilterOption
        adhocFilter={adhocFilter}
        onFilterEdit={this.onFilterEdit}
        options={this.state.options}
        datasource={this.props.datasource}
      />
    );
    this.state = {
      values: filters,
      options: this.optionsForSelect(this.props),
    };
  }

  componentWillReceiveProps(nextProps) {
    if (
      this.props.columns !== nextProps.columns ||
      this.props.formData !== nextProps.formData
    ) {
      this.setState({ options: this.optionsForSelect(nextProps) });
    }
    if (this.props.value !== nextProps.value) {
      this.setState({ values: this.coerceAdhocFilters(nextProps.value, nextProps.formData) });
    }
  }

  onFilterEdit(changedFilter) {
    this.props.onChange(this.state.values.map((value) => {
      if (value.filterOptionName === changedFilter.filterOptionName) {
        return changedFilter;
      }
      return value;
    }));
  }

  onChange(opts) {
    this.props.onChange(opts.map((option) => {
      if (option.saved_metric_name) {
        return new AdhocFilter({
          expressionType: this.props.datasource.type === 'druid' ?
            EXPRESSION_TYPES.SIMPLE :
            EXPRESSION_TYPES.SQL,
          subject: this.props.datasource.type === 'druid' ?
            option.saved_metric_name :
            this.getMetricExpression(option.saved_metric_name),
          operator: OPERATORS['>'],
          comparator: 0,
          clause: CLAUSES.HAVING,
        });
      } else if (option.label) {
        return new AdhocFilter({
          expressionType: this.props.datasource.type === 'druid' ?
            EXPRESSION_TYPES.SIMPLE :
            EXPRESSION_TYPES.SQL,
          subject: this.props.datasource.type === 'druid' ?
            option.label :
            new AdhocMetric(option).translateToSql(),
          operator: OPERATORS['>'],
          comparator: 0,
          clause: CLAUSES.HAVING,
        });
      } else if (option.column_name) {
        return new AdhocFilter({
          expressionType: EXPRESSION_TYPES.SIMPLE,
          subject: option.column_name,
          operator: OPERATORS['=='],
          comparator: '',
          clause: CLAUSES.WHERE,
        });
      } else if (option instanceof AdhocFilter) {
        return option;
      }
      return null;
    }).filter(option => option));
  }

  getMetricExpression(savedMetricName) {
    return this.props.savedMetrics.find((
      savedMetric => savedMetric.metric_name === savedMetricName
    )).expression;
  }

  coerceAdhocFilters(propsValues, formData) {
    // this converts filters from the four legacy filter controls into adhoc filters in the case
    // someone loads an old slice in the explore view
    if (propsValues) {
      return propsValues.map(filter => (
        isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter
      ));
    }
    return [
      ...(formData.filters || []).map(filter => (
        new AdhocFilter({
          subject: filter.col,
          operator: filter.op,
          comparator: filter.val,
          clause: CLAUSES.WHERE,
          expressionType: EXPRESSION_TYPES.SIMPLE,
          filterOptionName: this.generateConvertedFilterOptionName(),
        })
      )),
      ...(formData.having_filters || []).map(filter => (
        new AdhocFilter({
          subject: filter.col,
          operator: filter.op,
          comparator: filter.val,
          clause: CLAUSES.HAVING,
          expressionType: EXPRESSION_TYPES.SIMPLE,
          filterOptionName: this.generateConvertedFilterOptionName(),
        })
      )),
      ...[
        formData.where ?
        new AdhocFilter({
          sqlExpression: formData.where,
          clause: CLAUSES.WHERE,
          expressionType: EXPRESSION_TYPES.SQL,
          filterOptionName: this.generateConvertedFilterOptionName(),
        }) :
        null,
      ],
      ...[
        formData.having ?
        new AdhocFilter({
          sqlExpression: formData.having,
          clause: CLAUSES.HAVING,
          expressionType: EXPRESSION_TYPES.SQL,
          filterOptionName: this.generateConvertedFilterOptionName(),
        }) :
        null,
      ],
    ].filter(option => option);
  }

  generateConvertedFilterOptionName() {
      return `form_filter_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }

  optionsForSelect(props) {
    const options = [
      ...props.columns,
      ...[...props.formData.metrics, props.formData.metric].map(metric => (
        metric && (
          typeof metric === 'string' ?
          { saved_metric_name: metric } :
          new AdhocMetric(metric)
        )
      )),
    ].filter(option => option);

    return options.map((option) => {
      if (option.saved_metric_name) {
        return { ...option, filterOptionName: option.saved_metric_name };
      } else if (option.column_name) {
        return { ...option, filterOptionName: '_col_' + option.column_name };
      } else if (option instanceof AdhocMetric) {
        return { ...option, filterOptionName: '_adhocmetric_' + option.label };
      }
      return null;
    }).sort((a, b) => (
      (a.saved_metric_name || a.column_name || a.label || '').localeCompare((
        b.saved_metric_name || b.column_name || b.label
      ))
    ));
  }

  render() {
    return (
      <div className="metrics-select">
        <ControlHeader {...this.props} />
        <OnPasteSelect
          multi
          name={`select-${this.props.name}`}
          placeholder={t('choose a column or metric')}
          options={this.state.options}
          value={this.state.values}
          labelKey="label"
          valueKey="filterOptionName"
          clearable
          closeOnSelect
          onChange={this.onChange}
          optionRenderer={this.optionRenderer}
          valueRenderer={this.valueRenderer}
          selectWrap={VirtualizedSelect}
        />
      </div>
    );
  }
}

AdhocFilterControl.propTypes = propTypes;
AdhocFilterControl.defaultProps = defaultProps;
