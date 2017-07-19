import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button, Overlay,
  Popover, Badge, Label } from 'react-bootstrap';

import ColumnTypes from '../ColumnTypes';
import DateFilter from './DateFilter';
import RangeFilter from './RangeFilter';
import ValueFilter from './ValueFilter';


const propTypes = {
  name: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  columnType: PropTypes.string.isRequired,
  groupable: PropTypes.bool.isRequired,
  filter: PropTypes.arrayOf(PropTypes.string),
  intervalStart: PropTypes.string,
  intervalEnd: PropTypes.string,
  invert: PropTypes.bool,
  like: PropTypes.bool,


  leftOpen: PropTypes.bool,
  rightOpen: PropTypes.bool,

  remove: PropTypes.func,
  configure: PropTypes.func,
  datasource: PropTypes.string,
};

// TODO Refactor this and move more of the logic into the individual filters.
// SplitTile should be able to reuse some of the code
export default class FilterTile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = this.nextState(props);
    this.handleUpdates = this.handleUpdates.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleHide = this.handleHide.bind(this);
    this.isSet = this.isSet.bind(this);
  }

  componentWillReceiveProps(nextProps) {
    const nextState = this.nextState(nextProps);
    if (nextState) {
      this.setState(nextState);
    }
  }

  /** This handles default state values as well as handling state changes
   *  when undo/redo actions are performed
   * @param props
   * @returns the local component state that should follow
   */
  nextState(props) {
    if (!this.state) {
      return {
        groupable: props.groupable && props.columnType !== ColumnTypes.TIMESTAMP,
        showOverlay: !this.isSet(props),
        filter: props.filter,
        intervalStart: props.intervalStart,
        intervalEnd: props.intervalEnd,
        invert: props.invert,
        like: props.like,
        leftOpen: props.leftOpen,
        rightOpen: props.rightOpen,
      };
    }
    if (!this.state.showOverlay && !this.isSet(this.state)) {
      props.remove({ id: this.props.id });
    } else if (!this.state.groupable) {
      if (this.state.intervalStart !== props.intervalStart ||
              this.state.intervalEnd !== props.intervalEnd) {
        return {
          showOverlay: false,
          intervalStart: props.intervalStart,
          intervalEnd: props.intervalEnd,
          filter: [],
          invert: props.invert,
          like: props.like,
          leftOpen: props.leftOpen,
          rightOpen: props.rightOpen,
        };
      }
    } else if (JSON.stringify(this.state.filter) !==
            JSON.stringify(props.filter)) {
      return {
        showOverlay: false,
        intervalStart: null,
        intervalEnd: null,
        filter: props.filter,
        invert: props.invert,
        like: props.like,
        leftOpen: props.leftOpen,
        rightOpen: props.rightOpen,
      };
    }
    return null;
  }

  // This gets called when the Overlay is closed and changes are not OKed
  handleHide() {
    if (!this.isSet(this.props)) {
      this.props.remove({ id: this.props.id });
    } else {
      this.setState({
        intervalStart: this.props.intervalStart,
        intervalEnd: this.props.intervalEnd,
        filter: this.props.filter,
        invert: this.props.invert,
        like: this.like,
        leftOpen: this.props.leftOpen,
        rightOpen: this.props.rightOpen,
        showOverlay: false,
      });
    }
  }

  // Save changes to the filter
  handleSubmit(target) {
    if (!target || target.charCode === 13 || target.keyCode === 13) {
      const { filter, intervalStart, intervalEnd, invert, like,
       leftOpen, rightOpen, groupable } = this.state;
      this.setState({ showOverlay: false });
      if (!this.isSet(this.state)) {
        this.props.remove({ id: this.props.id });
      } else {
        const { id, name, columnType } = this.props;
        if (!groupable) {
          this.props.configure({
            id,
            name,
            columnType,
            groupable,
            filter: [],
            intervalStart,
            intervalEnd,
            invert,
            like: false,
            leftOpen,
            rightOpen,
          });
        } else {
          this.props.configure({
            id,
            name,
            columnType,
            groupable,
            filter,
            like: filter.length === 1 ? like : false,
            intervalStart: null,
            intervalEnd: null,
            invert,
            leftOpen,
            rightOpen,
          });
        }
      }
    }
  }

  // Checks if the filter is configured
  isSet({ filter, intervalStart, intervalEnd }) {
    if (this.props.columnType === ColumnTypes.TIMESTAMP) {
      return (intervalStart && intervalStart.length);
    }
    return (filter.length ||
        (intervalEnd && intervalEnd.length) ||
        (intervalStart && intervalStart.length));
  }

  handleUpdates(e, callback) {
    return this.setState(e, callback);
  }

  handleClick() {
    this.setState({ showOverlay: true });
  }

  // This will render the settings.
  renderControl() {
    if (this.props.columnType === ColumnTypes.TIMESTAMP) {
      return (
        <div
          style={{
            display: 'flex',
            flexFlow: 'space-between',
          }}
        >
          <div style={{ marginRight: '1rem' }}>
            <Label> Since </Label>
            <DateFilter
              clearButton
              value={this.state.intervalStart}
              onChange={v => this.setState({ intervalStart: v })}
              handleSubmit={this.handleSubmit}
            />
          </div>
          <div>
            <Label> Until </Label>
            <DateFilter
              nowButton
              value={this.state.intervalEnd}
              onChange={v => this.setState({ intervalEnd: v })}
              handleSubmit={this.handleSubmit}
            />
          </div>
        </div>
      );
    } else if (!this.state.groupable) {
      return (
        <RangeFilter
          intervalStart={this.state.intervalStart}
          intervalEnd={this.state.intervalEnd}
          leftOpen={this.state.leftOpen}
          rightOpen={this.state.rightOpen}
          onChange={this.handleUpdates}
          onSubmit={this.handleSubmit}
        />
      );
    }
    return (
      <ValueFilter
        id={this.props.id}
        datasource={this.props.datasource}
        filter={this.state.filter}
        like={this.state.like}
        invert={this.state.invert}
        onChange={this.handleUpdates}
      />
    );
  }

  render() {
    const { showOverlay, intervalStart, intervalEnd, filter, groupable } = this.state;
    const { name, remove, id } = this.props;

    let badgeName = '';
    if (!groupable) {
      badgeName = `${intervalStart || '-∞'} - ${intervalEnd || '∞'}`;
    } else if (filter.length) {
      if (filter.length === 1) {
        badgeName = filter[0];
      } else {
        badgeName = filter.length;
      }
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
            style={{
              maxWidth: '500px',
              minWidth: '250px',
            }}
            id={`popover-filter-${name}`}
            title={`Filter on ${name}`}
          >
            <div className="clearfix">
              {this.renderControl()}
            </div>
            <div id="popover-ok-button" className="clearfix">
              <Button
                disabled={!this.isSet(this.state)}
                bsStyle="primary"
                bsSize="small"
                onClick={() => this.handleSubmit()}
              >
                OK
              </Button>
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

FilterTile.defaultProps = {
  filter: [],
  intervalStart: '',
  intervalEnd: '',
  invert: false,
  like: false,
  leftOpen: false,
  rightOpen: false,
};

FilterTile.propTypes = propTypes;
