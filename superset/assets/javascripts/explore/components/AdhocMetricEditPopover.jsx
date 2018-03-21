import React from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, FormGroup, Popover } from 'react-bootstrap';
import VirtualizedSelect from 'react-virtualized-select';

import { AGGREGATES } from '../constants';
import { t } from '../../locales';
import VirtualizedRendererWrap from '../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../components/OnPasteSelect';
import AdhocMetricEditPopoverTitle from './AdhocMetricEditPopoverTitle';
import columnType from '../propTypes/columnType';
import AdhocMetric from '../AdhocMetric';
import ColumnOption from '../../components/ColumnOption';

const propTypes = {
  adhocMetric: PropTypes.instanceOf(AdhocMetric).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  columns: PropTypes.arrayOf(columnType),
  datasourceType: PropTypes.string,
};

const defaultProps = {
  columns: [],
};

export default class AdhocMetricEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onColumnChange = this.onColumnChange.bind(this);
    this.onAggregateChange = this.onAggregateChange.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.state = { adhocMetric: this.props.adhocMetric };
    this.selectProps = {
      multi: false,
      name: 'select-column',
      labelKey: 'label',
      autosize: false,
      clearable: true,
      selectWrap: VirtualizedSelect,
    };
  }

  onSave() {
    this.props.onChange(this.state.adhocMetric);
    this.props.onClose();
  }

  onColumnChange(column) {
    this.setState({ adhocMetric: this.state.adhocMetric.duplicateWith({ column }) });
  }

  onAggregateChange(aggregate) {
    // we construct this object explicitly to overwrite the value in the case aggregate is null
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        aggregate: aggregate && aggregate.aggregate,
      }),
    });
  }

  onLabelChange(e) {
    this.setState({
      adhocMetric: this.state.adhocMetric.duplicateWith({
        label: e.target.value, hasCustomLabel: true,
      }),
    });
  }

  render() {
    const { adhocMetric, columns, onChange, onClose, datasourceType, ...popoverProps } = this.props;

    const columnSelectProps = {
      placeholder: t('%s column(s)', columns.length),
      options: columns,
      value: this.state.adhocMetric.column && this.state.adhocMetric.column.column_name,
      onChange: this.onColumnChange,
      optionRenderer: VirtualizedRendererWrap(option => (
        <ColumnOption column={option} showType />
      )),
      valueRenderer: column => column.column_name,
      valueKey: 'column_name',
    };

    const aggregateSelectProps = {
      placeholder: t('%s aggregates(s)', Object.keys(AGGREGATES).length),
      options: Object.keys(AGGREGATES).map(aggregate => ({ aggregate })),
      value: this.state.adhocMetric.aggregate,
      onChange: this.onAggregateChange,
      optionRenderer: VirtualizedRendererWrap(aggregate => aggregate.aggregate),
      valueRenderer: aggregate => aggregate.aggregate,
      valueKey: 'aggregate',
    };

    if (this.props.datasourceType === 'druid') {
      aggregateSelectProps.options = aggregateSelectProps.options.filter((
        option => option.aggregate !== 'AVG'
      ));
    }

    const popoverTitle = (
      <AdhocMetricEditPopoverTitle
        adhocMetric={this.state.adhocMetric}
        onChange={this.onLabelChange}
      />
    );

    const stateIsValid = this.state.adhocMetric.column && this.state.adhocMetric.aggregate;
    const hasUnsavedChanges = this.state.adhocMetric.equals(this.props.adhocMetric);

    return (
      <Popover
        id="metrics-edit-popover"
        title={popoverTitle}
        {...popoverProps}
      >
        <FormGroup>
          <ControlLabel><strong>column</strong></ControlLabel>
          <OnPasteSelect {...this.selectProps} {...columnSelectProps} />
        </FormGroup>
        <FormGroup>
          <ControlLabel><strong>aggregate</strong></ControlLabel>
          <OnPasteSelect {...this.selectProps} {...aggregateSelectProps} />
        </FormGroup>
        <Button
          disabled={!stateIsValid}
          bsStyle={(hasUnsavedChanges || !stateIsValid) ? 'default' : 'primary'}
          bsSize="small"
          className="m-r-5"
          onClick={this.onSave}
        >
          Save
        </Button>
        <Button bsSize="small" onClick={this.props.onClose}>Close</Button>
      </Popover>
    );
  }
}
AdhocMetricEditPopover.propTypes = propTypes;
AdhocMetricEditPopover.defaultProps = defaultProps;
