import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Select from 'react-select';

import { FormControl, Button, Overlay, Popover, Badge, Label } from 'react-bootstrap';
import ColumnTypes from '../ColumnTypes';
import LabeledSelect from './LabeledSelect';


const propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  columnType: PropTypes.string.isRequired,
  granularity: PropTypes.string,
  justAdded: PropTypes.bool,

  timeGrains: PropTypes.arrayOf(PropTypes.string),
  metrics: PropTypes.arrayOf(PropTypes.object),
  selectedMetrics: PropTypes.object,
  remove: PropTypes.func,
  configure: PropTypes.func,

  limit: PropTypes.number,
  orderBy: PropTypes.string,
  orderDesc: PropTypes.bool,
};

const DEFAULT_LIMIT = 5;

// TODO Refactor this and pull out the components for configuring splits
// FilterTile should be able to reuse some of the code
export default class SplitTile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = this.nextState(props);
    this.handleUpdates = this.handleUpdates.bind(this);
    this.handleGranularity = this.handleGranularity.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleHide = this.handleHide.bind(this);
  }

  componentWillMount() {
    this.configure(this.props, this.state);
  }

  componentWillReceiveProps(nextProps) {
    const nextState = this.nextState(nextProps);
    if (nextState) {
      this.setState(nextState);
    }
  }

  configure(props, state) {
    const { id } = props;
    const { limit, granularity, orderBy, orderDesc } = state;
    this.props.configure({
      id, limit, granularity, orderBy, orderDesc,
    });
  }

  nextState(props) {
    if (props.columnType === ColumnTypes.TIMESTAMP) {
      if (!this.state ||
            this.state.granularity !== props.granularity) {
        return {
          showOverlay: false,
          granularity: props.granularity || props.timeGrains[props.timeGrains.length - 1],
          limit: null,
          orderBy: null,
          orderDesc: null,
        };
      }
    } else if (!this.state ||
          this.state.limit !== props.limit ||
          this.state.orderBy !== props.orderBy ||
          this.state.orderDesc !== props.orderDesc
      ) {
      const firstSelected = () => props.metrics.find(x => props.selectedMetrics[x.id]) || {};
      return {
        showOverlay: false,
        granularity: null,
        limit: props.limit || DEFAULT_LIMIT,
        orderBy: props.orderBy || firstSelected().id,
        orderDesc: props.orderDesc,
      };
    }
    return null;
  }

  handleSubmit(target) {
    if (!target || target.charCode === 13 || target.keyCode === 13) {
      this.configure(this.props, this.state);
      this.setState({ showOverlay: false });
    }
  }

  handleUpdates(e) {
    this.setState({ [e.target.name]: e.target.value });
  }

  handleGranularity(e) {
    this.setState({ granularity: e.value });
  }

  handleClick() {
    this.setState({ showOverlay: true });
  }

  handleHide() {
    this.setState({
      granularity: this.props.granularity,
      limit: this.props.limit,
      orderBy: this.props.orderBy,
      orderDesc: this.props.orderDesc,
      showOverlay: false,
    });
  }

  renderControl() {
    const { columnType, timeGrains, metrics, selectedMetrics } = this.props;
    if (columnType === ColumnTypes.TIMESTAMP) {
      const grains = timeGrains.map(x => ({ value: x, label: x }));
      return (
        <div>
          <LabeledSelect
            title="Granularity"
            options={grains}
            value={this.state.granularity}
            onChange={this.handleGranularity}
            onInputKeyDown={this.handleSubmit}
          />
        </div>
      );
    }
    const ms = metrics.filter(m => selectedMetrics[m.id])
                .map(m => ({ value: m.id, label: m.name }));
    return (
      <div>
        <Label>Sort By</Label>
        <div style={{ display: 'flex',
          flexWrap: 'nowrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem' }}
        >
          <div style={{ width: '90%' }}>
            <Select
              options={ms}
              value={this.state.orderBy}
              onChange={(e) => {
                this.setState({
                  orderBy: e.value });
              }}
              onInputKeyDown={this.handleSubmit}
              clearable={false}
            />
          </div>
          <a onClick={() => {
            this.setState({
              orderDesc: !this.state.orderDesc });
          }}
          >
            <i
              title="Sort order"
              className={`fa ${this.state.orderDesc ?
                                'fa-arrow-down' : 'fa-arrow-up'}`}
            />
          </a>
          <div className="clearfix" />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <Label>Limit</Label>
          <FormControl
            name="limit"
            value={this.state.limit}
            onChange={(e) => {
              this.setState({
                limit: e.target.value });
            }}
            onKeyPress={this.handleSubmit}
            bsSize="small"
          />
        </div>
      </div>
    );
  }

  render() {
    const { showOverlay, granularity } = this.state;
    const { name, remove, id, columnType } = this.props;
    let badgeName = '';
    if (columnType === ColumnTypes.TIMESTAMP) {
      badgeName = granularity;
    }
    return (
      <div
        style={{ marginLeft: '0.5rem' }}
        className="btn btn-primary"
        onClick={this.handleClick}
      >
        <Overlay
          show={showOverlay}
          placement="bottom"
          onHide={this.handleHide}
          trigger="click"
          rootClose
          target={this}
        >
          <Popover
            className="col-lg-2"
            id="popover-positioned-bottom"
            title={`Configure ${name}`}
          >
            {this.renderControl()}
            <div id="popover-ok-button" className="clearfix">
              <Button
                bsStyle="primary"
                bsSize="small"
                onClick={() => this.handleSubmit()}
              >OK</Button>
            </div>
          </Popover>
        </Overlay>
        <span style={{ paddingRight: '0.5rem' }}>{name}</span>
        <Badge>{badgeName}</Badge>
        <button
          type="button"
          style={{ paddingLeft: '0.5rem' }}
          className="close"
          data-dismiss="modal"
          onClick={() => remove({ id })}
        >&times;</button>
      </div>
    );
  }
}

SplitTile.propTypes = propTypes;
