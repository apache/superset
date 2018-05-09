import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  DropdownButton,
  FormControl,
  FormGroup,
  InputGroup,
  Label,
  MenuItem,
  OverlayTrigger,
  Popover,
  Radio,
  Tab,
  Tabs,
} from 'react-bootstrap';
import 'react-datetime/css/react-datetime.css';
import DateTimeField from 'react-bootstrap-datetimepicker';
import 'react-bootstrap-datetimepicker/css/bootstrap-datetimepicker.min.css';
import moment from 'moment';
import $ from 'jquery';

import ControlHeader from '../ControlHeader';
import InfoTooltipWithTrigger from '../../../components/InfoTooltipWithTrigger';
import { t } from '../../../locales';

const TYPES = ['range', 'startend'];
const COMMON_TIME_FRAMES = ['Yesterday', 'Last week', 'Last month', 'Last year'];
const RELATIVE_TIME_OPTIONS = ['Last', 'Next'];
const TIME_GRAIN_OPTIONS = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];

const MOMENT_FORMAT = 'YYYY-MM-DD[T]HH:mm:ss';
const DEFAULT_SINCE = moment().startOf('day').subtract(7, 'days').format(MOMENT_FORMAT);
const DEFAULT_UNTIL = moment().startOf('day').format(MOMENT_FORMAT);
const INPUT_IDS = {
  since: 'input_since',
  until: 'input_until',
};
const INVALID_DATE_MESSAGE = 'Invalid date';
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
  value: 'Today',
};

// backend (including migrating)


export default class DateFilterControl extends React.Component {
  constructor(props) {
    super(props);
    const value = props.value || defaultProps.value;
    this.state = {
      type: TYPES[0],

      // for range
      num: '7',
      grain: TIME_GRAIN_OPTIONS[3],
      rel: RELATIVE_TIME_OPTIONS[0],
      common: COMMON_TIME_FRAMES[0],

      // for start:end(includes freeform)
      since: DEFAULT_SINCE,
      until: DEFAULT_UNTIL,
      isFreeform: false,
    };
    if (value.indexOf(SEPARATOR) >= 0) {
      this.state.type = 'startend';
      [this.state.since, this.state.until] = value.split(SEPARATOR, 2);
    } else {
      this.state.type = 'range';
      if (COMMON_TIME_FRAMES.indexOf(value) >= 0) {
        this.state.common = value;
      } else {
        this.state.common = null;
        [this.state.rel, this.state.num, this.state.grain] = value.split(' ', 3);
      }
    }
  }
  setStartEnd(key, value) {
    const nextState = { type: 'startend' };
    if (value === INVALID_DATE_MESSAGE) {
      // the DateTimeField component will return `Invalid date` for freeform
      // text, so we need to cheat and steal the value old-school style
      const freeformValue = $('#' + INPUT_IDS[key]).val();
      nextState.isFreeform = true;
      nextState[key] = freeformValue;
    } else {
      nextState.isFreeform = false;
      nextState[key] = value;
    }
    this.setState(nextState);
  }
  setCommonRange(timeFrame) {
    const nextState = {
      type: 'range',
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
  setCustomRange(key, value) {
    const nextState = { ...this.state, type: 'range', common: null };
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
    if (this.state.type === 'range') {
      val = this.state.common
        ? this.state.common
        : `${this.state.rel} ${this.state.num} ${this.state.grain}`;
    } else if (this.state.type === 'startend') {
      val = [this.state.since, this.state.until].join(SEPARATOR);
    }
    this.props.onChange(val);
    this.refs.trigger.hide();
  }
  renderPopover() {
    const grainOptions = TIME_GRAIN_OPTIONS.map((grain, index) => (
      <MenuItem
        onSelect={this.setCustomRange.bind(this, 'grain')}
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
        onChange={this.setCommonRange.bind(this, timeFrame)}
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
            <Tab eventKey={1} title="Range">
              <FormGroup>
                {timeFrames}
                <Radio
                  checked={this.state.common == null && this.state.type === 'range'}
                  onChange={this.setCustomRange.bind(this)}
                >
                  <div className="clearfix centered">
                    <div style={{ width: '60px', marginTop: '-4px' }} className="input-inline">
                      <DropdownButton
                        bsSize="small"
                        componentClass={InputGroup.Button}
                        id="input-dropdown-rel"
                        title={this.state.rel}
                        onFocus={this.setCustomRange.bind(this)}
                      >
                        <MenuItem
                          onSelect={this.setCustomRange.bind(this, 'rel')}
                          key="Last"
                          eventKey="Last"
                          active={this.state.rel === 'Last'}
                        >Last
                        </MenuItem>
                        <MenuItem
                          onSelect={this.setCustomRange.bind(this, 'rel')}
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
                          this.setCustomRange.call(this, 'num', event.target.value)
                        )}
                        onFocus={this.setCustomRange.bind(this)}
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
                        onFocus={this.setCustomRange.bind(this)}
                      >
                        {grainOptions}
                      </DropdownButton>
                    </div>
                  </div>
                </Radio>
              </FormGroup>
            </Tab>
            <Tab eventKey={2} title="Start/End">
              <FormGroup>
                <InputGroup>
                  <div style={{ margin: '5px 0' }}>
                    <strong>Start</strong> &nbsp;
                    <InfoTooltipWithTrigger
                      tooltip={FREEFORM_TOOLTIP}
                      label="date-free-tooltip"
                    />
                    <DateTimeField
                      dateTime={this.state.isFreeform ? DEFAULT_SINCE : this.state.since}
                      defaultText={this.state.since}
                      onChange={this.setStartEnd.bind(this, 'since')}
                      maxDate={moment(this.state.until, MOMENT_FORMAT)}
                      format={MOMENT_FORMAT}
                      inputFormat={MOMENT_FORMAT}
                      inputProps={{ id: INPUT_IDS.since }}
                    />
                  </div>
                  <div style={{ margin: '5px 0' }}>
                    <strong>End</strong> &nbsp;
                    <InfoTooltipWithTrigger
                      tooltip={FREEFORM_TOOLTIP}
                      label="date-free-tooltip"
                    />
                    <DateTimeField
                      bsSize="small"
                      dateTime={this.state.isFreeform ? DEFAULT_UNTIL : this.state.until}
                      defaultText={this.state.until}
                      onChange={this.setStartEnd.bind(this, 'until')}
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
