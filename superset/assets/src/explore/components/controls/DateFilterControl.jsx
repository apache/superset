import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  ButtonGroup,
  DropdownButton,
  Form,
  FormControl,
  FormGroup,
  Glyphicon,
  InputGroup,
  Label,
  MenuItem,
  OverlayTrigger,
  Popover,
  Radio,
  Tab,
  Tabs,
} from 'react-bootstrap';
import Select from 'react-select';
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import DateTimeField from 'react-bootstrap-datetimepicker';
import 'react-bootstrap-datetimepicker/css/bootstrap-datetimepicker.min.css';
import moment from 'moment';
import $ from 'jquery';

import ControlHeader from '../ControlHeader';
import PopoverSection from '../../../components/PopoverSection';

const COMMON_TIME_FRAMES = ['Yesterday', 'Last week', 'Last month', 'Last year'];
const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const DEFAULT_SINCE = moment().startOf('day').subtract(7, 'days').format(MOMENT_FORMAT);
const DEFAULT_UNTIL = moment().startOf('day').format(MOMENT_FORMAT);
const INPUT_IDS = {
  since: 'input_since',
  until: 'input_until',
};
const INVALID_DATE_MESSAGE = 'Invalid date';
const RELATIVE_TIME_OPTIONS = ['Last', 'Next'];
const SEPARATOR = ' : ';
const TIME_GRAIN_OPTIONS = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
const TYPES = ['relative', 'fixed'];

const propTypes = {
  animation: PropTypes.bool,
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.string,
  height: PropTypes.number,
};

const defaultProps = {
  animation: true,
  onChange: () => {},
  value: 'Today',
};

// migrate/backwards compat
// backend


export default class DateFilterControl extends React.Component {
  constructor(props) {
    super(props);
    const value = props.value || defaultProps.value;
    this.state = {
      type: TYPES[0],

      // for relative
      num: '7',
      grain: TIME_GRAIN_OPTIONS[3],
      rel: RELATIVE_TIME_OPTIONS[0],
      common: COMMON_TIME_FRAMES[0],

      // for fixed (includes freeform)
      since: DEFAULT_SINCE,
      until: DEFAULT_UNTIL,
      isFreeform: false,
    };
    if (value.indexOf(SEPARATOR) >= 0) {
      this.state.type = 'fixed';
      [this.state.since, this.state.until] = value.split(SEPARATOR, 2);
    } else {
      this.state.type = 'relative';
      if (COMMON_TIME_FRAMES.indexOf(value) >= 0) {
        this.state.common = value;
      } else {
        this.state.common = null;
        [this.state.num, this.state.grain, this.state.rel] = value.split(' ', 3);
      }
    }
  }
  onNumberChange(event) {
    this.setState({ num: event.target.value });
  }
  setFixed(key, value) {
    const nextState = { type: 'fixed' };
    if (value === INVALID_DATE_MESSAGE) {
      let freeformValue = $('#' + INPUT_IDS[key]).val();
      if (freeformValue.trim() === '') {
        freeformValue = key === 'since' ? DEFAULT_SINCE : DEFAULT_UNTIL;
        nextState.isFreeform = false;
      } else {
        nextState.isFreeform = true;
      }
      nextState[key] = freeformValue;
    } else {
      nextState.isFreeform = false;
      nextState[key] = value;
    }
    this.setState(nextState);
  }
  setCommonRelative(timeFrame) {
    const nextState = {
      type: 'relative',
      common: timeFrame,
      until: moment().startOf('day').format(MOMENT_FORMAT),
    };
    let units;
    if (timeFrame === 'Yesterday') {
      units = 'days';
    } else {
      units = timeFrame.split(' ')[1] + 's';
    }
    nextState.since = moment().startOf('day').subtract(1, units).format(MOMENT_FORMAT);
    this.setState(nextState);
  }
  setCustomRelative(key, value) {
    const nextState = { ...this.state, type: 'relative', common: null };
    if (key !== undefined && value !== undefined) {
      nextState[key] = value;
    }
    if (nextState.rel === 'Last') {
      nextState.until = moment().startOf('day').format(MOMENT_FORMAT);
      nextState.since = moment()
        .startOf('day')
        .subtract(nextState.num, nextState.grain)
        .format(MOMENT_FORMAT);
    } else {
      nextState.until = moment()
        .startOf('day')
        .add(nextState.num, nextState.grain)
        .format(MOMENT_FORMAT);
      nextState.since = moment().startOf('day').format(MOMENT_FORMAT);
    }
    this.setState(nextState);
  }
  close() {
    let val;
    if (this.state.type === 'relative') {
      val = this.state.common
        ? this.state.common
        : `${this.state.num} ${this.state.grain} ${this.state.rel}`;
    } else if (this.state.type === 'fixed') {
      val = [this.state.since, this.state.until].join(SEPARATOR);
    }
    this.props.onChange(val);
    this.refs.trigger.hide();
  }
  renderPopover() {
    const grainOptions = TIME_GRAIN_OPTIONS.map((grain, index) => (
      <MenuItem
        onSelect={this.setCustomRelative.bind(this, 'grain')}
        key={index}
        eventKey={grain}
        active={grain === this.state.grain}
      >{grain}
      </MenuItem>
      ));
    const timeFrames = COMMON_TIME_FRAMES.map((timeFrame, index) => (
      <Radio
        key={index + 1}
        checked={this.state.common === timeFrame}
        onChange={this.setCommonRelative.bind(this, timeFrame)}
      >{timeFrame}
      </Radio>
      ));
    return (
      <Popover id="filter-popover" placement="top" positionTop={0}>
        <div style={{ width: '250px' }}>
          <Tabs
            defaultActiveKey={TYPES.indexOf(this.state.type) + 1}
            id="type"
            bsStyle="pills"
            onSelect={type => this.setState({ type: TYPES[type - 1] })}
          >
            <Tab eventKey={1} title="Relative">
              <FormGroup>
                {timeFrames}
                <Radio
                  checked={this.state.common == null && this.state.type === 'relative'}
                  onChange={this.setCustomRelative.bind(this)}
                >
                  <div className="clearfix centered">
                    <div style={{ width: '60px', marginTop: '-4px' }} className="input-inline">
                      <DropdownButton
                        bsSize="small"
                        componentClass={InputGroup.Button}
                        id="input-dropdown-rel"
                        title={this.state.rel}
                        onFocus={this.setCustomRelative.bind(this)}
                      >
                        <MenuItem
                          onSelect={this.setCustomRelative.bind(this, 'rel')}
                          key="Last"
                          eventKey="Last"
                          active={this.state.rel === 'Last'}
                        >Last
                        </MenuItem>
                        <MenuItem
                          onSelect={this.setCustomRelative.bind(this, 'rel')}
                          key="Next"
                          eventKey="Next"
                          active={this.state.rel === 'Next'}
                        >Next
                        </MenuItem>
                      </DropdownButton>
                    </div>
                    <div style={{ width: '60px', marginTop: '-4px' }} className="input-inline">
                      <FormControl
                        bsSize="small"
                        type="text"
                        onChange={event => (
                          this.setCustomRelative.call(this, 'num', event.target.value)
                        )}
                        onFocus={this.setCustomRelative.bind(this)}
                        value={this.state.num}
                        style={{ height: '30px' }}
                      />
                    </div>
                    <div style={{ width: '90px', marginTop: '-4px' }} className="input-inline">
                      <DropdownButton
                        bsSize="small"
                        componentClass={InputGroup.Button}
                        id="input-dropdown-grain"
                        title={this.state.grain}
                        onFocus={this.setCustomRelative.bind(this)}
                      >
                        {grainOptions}
                      </DropdownButton>
                    </div>
                  </div>
                </Radio>
              </FormGroup>
            </Tab>
            <Tab eventKey={2} title="Fixed">
              <FormGroup>
                <InputGroup>
                  <div style={{ margin: '5px 0' }}>
                    <strong>Since</strong>
                    <DateTimeField
                      dateTime={this.state.isFreeform ? DEFAULT_SINCE : this.state.since}
                      defaultText={this.state.since}
                      onChange={this.setFixed.bind(this, 'since')}
                      maxDate={moment(this.state.until, MOMENT_FORMAT)}
                      format={MOMENT_FORMAT}
                      inputFormat={MOMENT_FORMAT}
                      inputProps={{ id: INPUT_IDS.since }}
                    />
                  </div>
                  <div style={{ margin: '5px 0' }}>
                    <strong>Until</strong>
                    <DateTimeField
                      bsSize="small"
                      dateTime={this.state.isFreeform ? DEFAULT_UNTIL : this.state.until}
                      defaultText={this.state.until}
                      onChange={this.setFixed.bind(this, 'until')}
                      minDate={moment(this.state.since, MOMENT_FORMAT).add(1, 'days')}
                      format={MOMENT_FORMAT}
                      inputFormat={MOMENT_FORMAT}
                      inputProps={{ id: INPUT_IDS.until }}
                    />
                  </div>
                </InputGroup>
              </FormGroup>
            </Tab>
          </Tabs>
          <div className="clearfix">
            <Button
              bsSize="small"
              className="float-right ok"
              bsStyle="primary"
              onClick={this.close.bind(this)}
            >
              Ok
            </Button>
          </div>
        </div>
      </Popover>
    );
  }
  render() {
    const value = this.props.value || defaultProps.value;
    return (
      <div>
        <ControlHeader {...this.props} />
        <OverlayTrigger
          animation={this.props.animation}
          container={document.body}
          trigger="click"
          rootClose
          ref="trigger"
          placement="right"
          overlay={this.renderPopover()}
        >
          <Label style={{ cursor: 'pointer' }}>
            {value.replace(/T00:00:00/g, '') || '∞'}
          </Label>
        </OverlayTrigger>
      </div>
    );
  }
}

DateFilterControl.propTypes = propTypes;
DateFilterControl.defaultProps = defaultProps;
