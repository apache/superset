import React from 'react';
import PropTypes from 'prop-types';
import { Button, Popover, Tab, Tabs } from 'react-bootstrap';

import columnType from '../propTypes/columnType';
import adhocMetricType from '../propTypes/adhocMetricType';
import AdhocFilter, { EXPRESSION_TYPES } from '../AdhocFilter';
import AdhocFilterEditPopoverSimpleTabContent from './AdhocFilterEditPopoverSimpleTabContent';
import AdhocFilterEditPopoverSqlTabContent from './AdhocFilterEditPopoverSqlTabContent';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.oneOfType([
    columnType,
    PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
    adhocMetricType,
  ])).isRequired,
  datasource: PropTypes.object,
};

const startingWidth = 300;
const startingHeight = 190;

export default class AdhocFilterEditPopover extends React.Component {
  constructor(props) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onDragDown = this.onDragDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onAdhocFilterChange = this.onAdhocFilterChange.bind(this);

    this.state = {
      adhocFilter: this.props.adhocFilter,
      width: startingWidth,
      height: startingHeight,
    };
  }

  componentDidMount() {
    document.addEventListener('mouseup', this.onMouseUp);
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  onAdhocFilterChange(adhocFilter) {
    this.setState({ adhocFilter });
  }

  onSave() {
    this.props.onChange(this.state.adhocFilter);
    this.props.onClose();
  }

  onDragDown(e) {
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartWidth = this.state.width;
    this.dragStartHeight = this.state.height;
    document.addEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(e) {
    this.props.onResize();
    this.setState({
      width: Math.max(this.dragStartWidth + (e.clientX - this.dragStartX), startingWidth),
      height: Math.max(this.dragStartHeight + (e.clientY - this.dragStartY) * 2, startingHeight),
    });
  }

  onMouseUp() {
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  render() {
    const {
      adhocFilter: propsAdhocFilter,
      options,
      onChange,
      onClose,
      onResize,
      datasource,
      ...popoverProps
    } = this.props;

    const { adhocFilter } = this.state;

    const stateIsValid = adhocFilter.isValid();
    const hasUnsavedChanges = !adhocFilter.equals(propsAdhocFilter);

    return (
      <Popover
        id="filter-edit-popover"
        {...popoverProps}
      >
        <Tabs
          id="adhoc-filter-edit-tabs"
          defaultActiveKey={adhocFilter.expressionType}
          className="adhoc-filter-edit-tabs"
          style={{ height: this.state.height, width: this.state.width }}
        >
          <Tab
            className="adhoc-filter-edit-tab"
            eventKey={EXPRESSION_TYPES.SIMPLE}
            title="Simple"
          >
            <AdhocFilterEditPopoverSimpleTabContent
              adhocFilter={this.state.adhocFilter}
              onChange={this.onAdhocFilterChange}
              options={this.props.options}
              datasource={this.props.datasource}
            />
          </Tab>
          {
            (!this.props.datasource || this.props.datasource.type !== 'druid') &&
            <Tab
              className="adhoc-filter-edit-tab"
              eventKey={EXPRESSION_TYPES.SQL}
              title="Custom SQL"
            >
              <AdhocFilterEditPopoverSqlTabContent
                adhocFilter={this.state.adhocFilter}
                onChange={this.onAdhocFilterChange}
                options={this.props.options}
                height={this.state.height}
              />
            </Tab>
          }
        </Tabs>
        <div>
          <Button
            disabled={!stateIsValid}
            bsStyle={(hasUnsavedChanges && stateIsValid) ? 'primary' : 'default'}
            bsSize="small"
            className="m-r-5"
            onClick={this.onSave}
          >
            Save
          </Button>
          <Button bsSize="small" onClick={this.props.onClose}>Close</Button>
          <i onMouseDown={this.onDragDown} className="glyphicon glyphicon-resize-full edit-popover-resize" />
        </div>
      </Popover>
    );
  }
}
AdhocFilterEditPopover.propTypes = propTypes;
