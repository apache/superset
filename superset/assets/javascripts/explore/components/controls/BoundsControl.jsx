import React from 'react';
import PropTypes from 'prop-types';
import { Col, Row, FormGroup, FormControl } from 'react-bootstrap';
import ControlHeader from '../ControlHeader';

const propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  description: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.array,
};

const defaultProps = {
  label: null,
  description: null,
  onChange: () => {},
  value: [null, null],
};

export default class BoundsControl extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      minMax: [
        props.value[0] === null ? '' : props.value[0],
        props.value[1] === null ? '' : props.value[1],
      ],
    };
    this.onChange = this.onChange.bind(this);
    this.onMinChange = this.onMinChange.bind(this);
    this.onMaxChange = this.onMaxChange.bind(this);
  }
  onMinChange(event) {
    this.setState({
      minMax: [
        event.target.value,
        this.state.minMax[1],
      ],
    }, this.onChange);
  }
  onMaxChange(event) {
    this.setState({
      minMax: [
        this.state.minMax[0],
        event.target.value,
      ],
    }, this.onChange);
  }
  onChange() {
    const mm = this.state.minMax;
    const errors = [];
    if (mm[0] && isNaN(mm[0])) {
      errors.push('`From` value should be numeric or empty');
    }
    if (mm[1] && isNaN(mm[1])) {
      errors.push('`To` value should be numeric or empty');
    }
    if (errors.length === 0) {
      this.props.onChange([parseFloat(mm[0]), parseFloat(mm[1])], errors);
    } else {
      this.props.onChange([null, null], errors);
    }
  }
  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <FormGroup controlId="formInlineName" bsSize="small">
          <Row>
            <Col xs={6} key="from">
              <FormControl
                type="text"
                placeholder="From"
                onChange={this.onMinChange}
                value={this.state.minMax[0]}
              />
            </Col>
            <Col xs={6} key="to">
              <FormControl
                type="text"
                placeholder="To"
                onChange={this.onMaxChange}
                value={this.state.minMax[1]}
              />
            </Col>
          </Row>
        </FormGroup>
      </div>
    );
  }
}

BoundsControl.propTypes = propTypes;
BoundsControl.defaultProps = defaultProps;
