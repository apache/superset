import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  DropdownButton,
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
import Datetime from 'react-datetime';
import 'react-datetime/css/react-datetime.css';
import moment from 'moment';

import './DateFilterControl.css';
import ControlHeader from '../ControlHeader';
import { t } from '../../../locales';
import PopoverSection from '../../../components/PopoverSection';

const TYPES = Object.freeze({
  DEFAULTS: 'defaults',
  CUSTOM_START_END: 'custom_start_end',
  CUSTOM_RANGE: 'custom_range',
});
const RELATIVE_TIME_OPTIONS = Object.freeze({
  LAST: 'Last',
  NEXT: 'Next',
});
const COMMON_TIME_FRAMES = [
  'Last day',
  'Last week',
  'Last month',
  'Last quarter',
  'Last year',
  'No filter',
];
const TIME_GRAIN_OPTIONS = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];

const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const DEFAULT_SINCE = moment().startOf('day').subtract(7, 'days').format(MOMENT_FORMAT);
const DEFAULT_UNTIL = moment().startOf('day').format(MOMENT_FORMAT);
const SEPARATOR = ' : ';
const FREEFORM_TOOLTIP = t(
  'Superset supports smart date parsing. Strings like `last sunday` or ' +
  '`last october` can be used.',
);

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
  value: 'Last week',
};

function isValidMoment(s) {
  /* Moment sometimes consider invalid dates as valid, eg, "10 years ago" gets
   * parsed as "Fri Jan 01 2010 00:00:00" local time. This function does a
   * better check by comparing a string with a parse/format roundtrip.
   */
  return (s === moment(s, MOMENT_FORMAT).format(MOMENT_FORMAT));
}

function getStateFromSeparator(value) {
  const [since, until] = value.split(SEPARATOR, 2);
  return { since, until, type: TYPES.CUSTOM_START_END };
}

function getStateFromCommonTimeFrame(value) {
  const units = value.split(' ')[1] + 's';
  return {
    type: TYPES.DEFAULTS,
    common: value,
    since: moment().startOf('day').subtract(1, units).format(MOMENT_FORMAT),
    until: moment().startOf('day').format(MOMENT_FORMAT),
  };
}

function getStateFromCustomRange(value) {
  const [rel, num, grain] = value.split(' ', 3);
  let since;
  let until;
  if (rel === RELATIVE_TIME_OPTIONS.LAST) {
    until = moment().startOf('day').format(MOMENT_FORMAT);
    since = moment()
      .startOf('day')
      .subtract(num, grain)
      .format(MOMENT_FORMAT);
  } else {
    until = moment()
      .startOf('day')
      .add(num, grain)
      .format(MOMENT_FORMAT);
    since = moment().startOf('day').format(MOMENT_FORMAT);
  }
  return {
    type: TYPES.CUSTOM_RANGE,
    common: null,
    rel,
    num,
    grain,
    since,
    until,
  };
}

export default class DateFilterControl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      type: TYPES.DEFAULTS,

      // default time frames, for convenience
      common: COMMON_TIME_FRAMES[0],

      // "last 7 days", "next 4 weeks", etc.
      rel: RELATIVE_TIME_OPTIONS.LAST,
      num: '7',
      grain: TIME_GRAIN_OPTIONS[3],

      // distinct start/end values, either ISO or freeform
      since: DEFAULT_SINCE,
      until: DEFAULT_UNTIL,

      // react-datetime has a `closeOnSelect` prop, but it's buggy... so we
      // handle the calendar visibility here ourselves
      showSinceCalendar: false,
      showUntilCalendar: false,
      sinceViewMode: 'days',
      untilViewMode: 'days',
    };

    this.close = this.close.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.isValidSince = this.isValidSince.bind(this);
    this.isValidUntil = this.isValidUntil.bind(this);
    this.onEnter = this.onEnter.bind(this);
    this.renderInput = this.renderInput.bind(this);
    this.setCustomRange = this.setCustomRange.bind(this);
    this.setCustomStartEnd = this.setCustomStartEnd.bind(this);
    this.setTypeCustomRange = this.setTypeCustomRange.bind(this);
    this.setTypeCustomStartEnd = this.setTypeCustomStartEnd.bind(this);
    this.toggleCalendar = this.toggleCalendar.bind(this);
  }
  componentDidMount() {
    const value = this.props.value;
    if (value.indexOf(SEPARATOR) >= 0) {
      this.state = { ...this.state, ...getStateFromSeparator(value) };
    } else if (COMMON_TIME_FRAMES.indexOf(value) >= 0) {
      this.state = { ...this.state, ...getStateFromCommonTimeFrame(value) };
    } else {
      this.state = { ...this.state, ...getStateFromCustomRange(value) };
    }
    document.addEventListener('click', this.handleClick);
  }
  componentWillUnmount() {
    document.removeEventListener('click', this.handleClick);
  }
  onEnter(event) {
    if (event.key === 'Enter') {
      this.close();
    }
  }
  setCustomRange(key, value) {
    const updatedState = { ...this.state, [key]: value };
    const combinedValue = [updatedState.rel, updatedState.num, updatedState.grain].join(' ');
    this.setState(getStateFromCustomRange(combinedValue));
  }
  setCustomStartEnd(key, value) {
    const closeCalendar = (
      (key === 'since' && this.state.sinceViewMode === 'days') ||
      (key === 'until' && this.state.untilViewMode === 'days')
    );
    this.setState({
      type: TYPES.CUSTOM_START_END,
      [key]: typeof value === 'string' ? value : value.format(MOMENT_FORMAT),
      showSinceCalendar: this.state.showSinceCalendar && !closeCalendar,
      showUntilCalendar: this.state.showUntilCalendar && !closeCalendar,
      sinceViewMode: closeCalendar ? 'days' : this.state.sinceViewMode,
      untilViewMode: closeCalendar ? 'days' : this.state.untilViewMode,
    });
  }
  setTypeCustomRange() {
    this.setState({ type: TYPES.CUSTOM_RANGE });
  }
  setTypeCustomStartEnd() {
    this.setState({ type: TYPES.CUSTOM_START_END });
  }
  handleClick(e) {
    // switch to `TYPES.CUSTOM_START_END` when the calendar is clicked
    if (this.startEndSectionRef && this.startEndSectionRef.contains(e.target)) {
      this.setTypeCustomStartEnd();
    }
  }
  close() {
    let val;
    if (this.state.type === TYPES.DEFAULTS) {
      val = this.state.common;
    } else if (this.state.type === TYPES.CUSTOM_RANGE) {
      val = `${this.state.rel} ${this.state.num} ${this.state.grain}`;
    } else {
      val = [this.state.since, this.state.until].join(SEPARATOR);
    }
    this.props.onChange(val);
    this.refs.trigger.hide();
    this.setState({ showSinceCalendar: false, showUntilCalendar: false });
  }
  isValidSince(date) {
    return (!isValidMoment(this.state.until) || date <= moment(this.state.until, MOMENT_FORMAT));
  }
  isValidUntil(date) {
    return (!isValidMoment(this.state.since) || date >= moment(this.state.since, MOMENT_FORMAT));
  }
  toggleCalendar(key) {
    const nextState = {};
    if (key === 'showSinceCalendar') {
      nextState.showSinceCalendar = !this.state.showSinceCalendar;
      if (!this.state.showSinceCalendar) {
        nextState.showUntilCalendar = false;
      }
    } else if (key === 'showUntilCalendar') {
      nextState.showUntilCalendar = !this.state.showUntilCalendar;
      if (!this.state.showUntilCalendar) {
        nextState.showSinceCalendar = false;
      }
    }
    this.setState(nextState);
  }
  renderInput(props, key) {
    return (
      <FormGroup>
        <InputGroup>
          <FormControl
            {...props}
            type="text"
            onKeyPress={this.onEnter}
            onFocus={this.setTypeCustomStartEnd}
            onClick={() => {}}
          />
          <InputGroup.Button onClick={() => this.toggleCalendar(key)}>
            <Button>
              <Glyphicon glyph="calendar" style={{ padding: 3 }} />
            </Button>
          </InputGroup.Button>
        </InputGroup>
      </FormGroup>
    );
  }
  renderPopover() {
    const grainOptions = TIME_GRAIN_OPTIONS.map(grain => (
      <MenuItem
        onSelect={value => this.setCustomRange('grain', value)}
        key={grain}
        eventKey={grain}
        active={grain === this.state.grain}
      >
        {grain}
      </MenuItem>
      ));
    const timeFrames = COMMON_TIME_FRAMES.map(timeFrame => (
      <Radio
        key={timeFrame.replace(' ', '').toLowerCase()}
        checked={this.state.common === timeFrame}
        onChange={() => this.setState(getStateFromCommonTimeFrame(timeFrame))}
      >
        {timeFrame}
      </Radio>
      ));
    return (
      <Popover id="filter-popover" placement="top" positionTop={0}>
        <div style={{ width: '250px' }}>
          <Tabs
            defaultActiveKey={this.state.type === TYPES.DEFAULTS ? 1 : 2}
            id="type"
            className="time-filter-tabs"
          >
            <Tab eventKey={1} title="Defaults">
              <FormGroup>{timeFrames}</FormGroup>
            </Tab>
            <Tab eventKey={2} title="Custom">
              <FormGroup>
                <PopoverSection
                  title="Relative to today"
                  isSelected={this.state.type === TYPES.CUSTOM_RANGE}
                  onSelect={this.setTypeCustomRange}
                >
                  <div className="clearfix centered" style={{ marginTop: '12px' }}>
                    <div style={{ width: '60px', marginTop: '-4px' }} className="input-inline">
                      <DropdownButton
                        bsSize="small"
                        componentClass={InputGroup.Button}
                        id="input-dropdown-rel"
                        title={this.state.rel}
                        onFocus={this.setTypeCustomRange}
                      >
                        <MenuItem
                          onSelect={value => this.setCustomRange('rel', value)}
                          key={RELATIVE_TIME_OPTIONS.LAST}
                          eventKey={RELATIVE_TIME_OPTIONS.LAST}
                          active={this.state.rel === RELATIVE_TIME_OPTIONS.LAST}
                        >Last
                        </MenuItem>
                        <MenuItem
                          onSelect={value => this.setCustomRange('rel', value)}
                          key={RELATIVE_TIME_OPTIONS.NEXT}
                          eventKey={RELATIVE_TIME_OPTIONS.NEXT}
                          active={this.state.rel === RELATIVE_TIME_OPTIONS.NEXT}
                        >Next
                        </MenuItem>
                      </DropdownButton>
                    </div>
                    <div style={{ width: '60px', marginTop: '-4px' }} className="input-inline">
                      <FormControl
                        bsSize="small"
                        type="text"
                        onChange={event => this.setCustomRange('num', event.target.value)}
                        onFocus={this.setTypeCustomRange}
                        onKeyPress={this.onEnter}
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
                        onFocus={this.setTypeCustomRange}
                      >
                        {grainOptions}
                      </DropdownButton>
                    </div>
                  </div>
                </PopoverSection>
                <PopoverSection
                  title="Start / end"
                  isSelected={this.state.type === TYPES.CUSTOM_START_END}
                  onSelect={this.setTypeCustomStartEnd}
                  info={FREEFORM_TOOLTIP}
                >
                  <div ref={(ref) => { this.startEndSectionRef = ref; }}>
                    <InputGroup>
                      <div style={{ margin: '5px 0' }}>
                        <Datetime
                          value={this.state.since}
                          defaultValue={this.state.since}
                          viewDate={this.state.since}
                          onChange={value => this.setCustomStartEnd('since', value)}
                          isValidDate={this.isValidSince}
                          onClick={this.setTypeCustomStartEnd}
                          renderInput={props => this.renderInput(props, 'showSinceCalendar')}
                          open={this.state.showSinceCalendar}
                          viewMode={this.state.sinceViewMode}
                          onViewModeChange={sinceViewMode => this.setState({ sinceViewMode })}
                        />
                      </div>
                      <div style={{ margin: '5px 0' }}>
                        <Datetime
                          value={this.state.until}
                          defaultValue={this.state.until}
                          viewDate={this.state.until}
                          onChange={value => this.setCustomStartEnd('until', value)}
                          isValidDate={this.isValidUntil}
                          onClick={this.setTypeCustomStartEnd}
                          renderInput={props => this.renderInput(props, 'showUntilCalendar')}
                          open={this.state.showUntilCalendar}
                          viewMode={this.state.untilViewMode}
                          onViewModeChange={untilViewMode => this.setState({ untilViewMode })}
                        />
                      </div>
                    </InputGroup>
                  </div>
                </PopoverSection>
              </FormGroup>
            </Tab>
          </Tabs>
          <div className="clearfix">
            <Button
              bsSize="small"
              className="float-right ok"
              bsStyle="primary"
              onClick={this.close}
            >
              Ok
            </Button>
          </div>
        </div>
      </Popover>
    );
  }
  render() {
    let value = this.props.value || defaultProps.value;
    value = value.split(SEPARATOR).map(v => v.replace('T00:00:00', '') || '∞').join(SEPARATOR);
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
          <Label style={{ cursor: 'pointer' }}>{value}</Label>
        </OverlayTrigger>
      </div>
    );
  }
}

DateFilterControl.propTypes = propTypes;
DateFilterControl.defaultProps = defaultProps;
