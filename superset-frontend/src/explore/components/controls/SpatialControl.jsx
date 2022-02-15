/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'src/common/components';
import { t } from '@superset-ui/core';

import Label from 'src/components/Label';
import Popover from 'src/components/Popover';
import PopoverSection from 'src/components/PopoverSection';
import Checkbox from 'src/components/Checkbox';
import ControlHeader from '../ControlHeader';
import SelectControl from './SelectControl';

const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
};

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.object,
  animation: PropTypes.bool,
  choices: PropTypes.array,
};

const defaultProps = {
  onChange: () => {},
  animation: true,
  choices: [],
};

export default class SpatialControl extends React.Component {
  constructor(props) {
    super(props);
    const v = props.value || {};
    let defaultCol;
    if (props.choices.length > 0) {
      defaultCol = props.choices[0][0];
    }
    this.state = {
      type: v.type || spatialTypes.latlong,
      delimiter: v.delimiter || ',',
      latCol: v.latCol || defaultCol,
      lonCol: v.lonCol || defaultCol,
      lonlatCol: v.lonlatCol || defaultCol,
      reverseCheckbox: v.reverseCheckbox || false,
      geohashCol: v.geohashCol || defaultCol,
      value: null,
      errors: [],
    };
    this.toggleCheckbox = this.toggleCheckbox.bind(this);
    this.onChange = this.onChange.bind(this);
    this.renderReverseCheckbox = this.renderReverseCheckbox.bind(this);
  }

  componentDidMount() {
    this.onChange();
  }

  onChange() {
    const { type } = this.state;
    const value = { type };
    const errors = [];
    const errMsg = t('Invalid lat/long configuration.');
    if (type === spatialTypes.latlong) {
      value.latCol = this.state.latCol;
      value.lonCol = this.state.lonCol;
      if (!value.lonCol || !value.latCol) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      value.lonlatCol = this.state.lonlatCol;
      value.delimiter = this.state.delimiter;
      value.reverseCheckbox = this.state.reverseCheckbox;
      if (!value.lonlatCol || !value.delimiter) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      value.geohashCol = this.state.geohashCol;
      value.reverseCheckbox = this.state.reverseCheckbox;
      if (!value.geohashCol) {
        errors.push(errMsg);
      }
    }
    this.setState({ value, errors });
    this.props.onChange(value, errors);
  }

  setType(type) {
    this.setState({ type }, this.onChange);
  }

  toggleCheckbox() {
    this.setState(
      prevState => ({ reverseCheckbox: !prevState.reverseCheckbox }),
      this.onChange,
    );
  }

  renderLabelContent() {
    if (this.state.errors.length > 0) {
      return 'N/A';
    }
    if (this.state.type === spatialTypes.latlong) {
      return `${this.state.lonCol} | ${this.state.latCol}`;
    }
    if (this.state.type === spatialTypes.delimited) {
      return `${this.state.lonlatCol}`;
    }
    if (this.state.type === spatialTypes.geohash) {
      return `${this.state.geohashCol}`;
    }
    return null;
  }

  renderSelect(name, type) {
    return (
      <SelectControl
        ariaLabel={name}
        name={name}
        choices={this.props.choices}
        value={this.state[name]}
        clearable={false}
        onFocus={() => {
          this.setType(type);
        }}
        onChange={value => {
          this.setState({ [name]: value }, this.onChange);
        }}
      />
    );
  }

  renderReverseCheckbox() {
    return (
      <span>
        {t('Reverse lat/long ')}
        <Checkbox
          checked={this.state.reverseCheckbox}
          onChange={this.toggleCheckbox}
        />
      </span>
    );
  }

  renderPopoverContent() {
    return (
      <div style={{ width: '300px' }}>
        <PopoverSection
          title={t('Longitude & Latitude columns')}
          isSelected={this.state.type === spatialTypes.latlong}
          onSelect={this.setType.bind(this, spatialTypes.latlong)}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              Longitude
              {this.renderSelect('lonCol', spatialTypes.latlong)}
            </Col>
            <Col xs={24} md={12}>
              Latitude
              {this.renderSelect('latCol', spatialTypes.latlong)}
            </Col>
          </Row>
        </PopoverSection>
        <PopoverSection
          title={t('Delimited long & lat single column')}
          info={t(
            'Multiple formats accepted, look the geopy.points ' +
              'Python library for more details',
          )}
          isSelected={this.state.type === spatialTypes.delimited}
          onSelect={this.setType.bind(this, spatialTypes.delimited)}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              {t('Column')}
              {this.renderSelect('lonlatCol', spatialTypes.delimited)}
            </Col>
            <Col xs={24} md={12}>
              {this.renderReverseCheckbox()}
            </Col>
          </Row>
        </PopoverSection>
        <PopoverSection
          title={t('Geohash')}
          isSelected={this.state.type === spatialTypes.geohash}
          onSelect={this.setType.bind(this, spatialTypes.geohash)}
        >
          <Row gutter={16}>
            <Col xs={24} md={12}>
              Column
              {this.renderSelect('geohashCol', spatialTypes.geohash)}
            </Col>
            <Col xs={24} md={12}>
              {this.renderReverseCheckbox()}
            </Col>
          </Row>
        </PopoverSection>
      </div>
    );
  }

  render() {
    return (
      <div>
        <ControlHeader {...this.props} />
        <Popover
          content={this.renderPopoverContent()}
          placement="topLeft" // so that popover doesn't move when label changes
          trigger="click"
        >
          <Label className="pointer">{this.renderLabelContent()}</Label>
        </Popover>
      </div>
    );
  }
}

SpatialControl.propTypes = propTypes;
SpatialControl.defaultProps = defaultProps;
