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
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'src/components';
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

const SpatialControl = props => {
  const { onChange, value, choices } = props;

  // Initialize state
  let defaultCol;
  if (choices.length > 0) {
    defaultCol = choices[0][0];
  }

  const v = value || {};
  const [type, setType] = useState(v.type || spatialTypes.latlong);
  const [delimiter] = useState(v.delimiter || ',');
  const [latCol, setLatCol] = useState(v.latCol || defaultCol);
  const [lonCol, setLonCol] = useState(v.lonCol || defaultCol);
  const [lonlatCol, setLonlatCol] = useState(v.lonlatCol || defaultCol);
  const [reverseCheckbox, setReverseCheckbox] = useState(
    v.reverseCheckbox || false,
  );
  const [geohashCol, setGeohashCol] = useState(v.geohashCol || defaultCol);
  const [errors, setErrors] = useState([]);

  // Handle changes to state
  const handleChange = useCallback(() => {
    const newValue = { type };
    const newErrors = [];
    const errMsg = t('Invalid lat/long configuration.');

    if (type === spatialTypes.latlong) {
      newValue.latCol = latCol;
      newValue.lonCol = lonCol;
      if (!newValue.lonCol || !newValue.latCol) {
        newErrors.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      newValue.lonlatCol = lonlatCol;
      newValue.delimiter = delimiter;
      newValue.reverseCheckbox = reverseCheckbox;
      if (!newValue.lonlatCol || !newValue.delimiter) {
        newErrors.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      newValue.geohashCol = geohashCol;
      newValue.reverseCheckbox = reverseCheckbox;
      if (!newValue.geohashCol) {
        newErrors.push(errMsg);
      }
    }

    setErrors(newErrors);
    onChange(newValue, newErrors);
  }, [
    type,
    latCol,
    lonCol,
    lonlatCol,
    delimiter,
    reverseCheckbox,
    geohashCol,
    onChange,
  ]);

  // Call handleChange when component mounts
  useEffect(() => {
    handleChange();
  }, [handleChange]);

  // Handle type change
  const handleTypeChange = useCallback(newType => {
    setType(newType);
  }, []);

  // Toggle checkbox
  const toggleCheckbox = useCallback(() => {
    setReverseCheckbox(!reverseCheckbox);
  }, [reverseCheckbox]);

  // Render label content
  const renderLabelContent = () => {
    if (errors.length > 0) {
      return 'N/A';
    }
    if (type === spatialTypes.latlong) {
      return `${lonCol} | ${latCol}`;
    }
    if (type === spatialTypes.delimited) {
      return `${lonlatCol}`;
    }
    if (type === spatialTypes.geohash) {
      return `${geohashCol}`;
    }
    return null;
  };

  // Render select control
  const renderSelect = (name, selectType) => {
    const selectProps = {
      ariaLabel: name,
      name,
      choices,
      clearable: false,
      onFocus: () => {
        handleTypeChange(selectType);
      },
    };

    if (name === 'lonCol') {
      selectProps.value = lonCol;
      selectProps.onChange = value => {
        setLonCol(value);
      };
    } else if (name === 'latCol') {
      selectProps.value = latCol;
      selectProps.onChange = value => {
        setLatCol(value);
      };
    } else if (name === 'lonlatCol') {
      selectProps.value = lonlatCol;
      selectProps.onChange = value => {
        setLonlatCol(value);
      };
    } else if (name === 'geohashCol') {
      selectProps.value = geohashCol;
      selectProps.onChange = value => {
        setGeohashCol(value);
      };
    }

    return <SelectControl {...selectProps} />;
  };

  // Render reverse checkbox
  const renderReverseCheckbox = () => (
    <span>
      {t('Reverse lat/long ')}
      <Checkbox checked={reverseCheckbox} onChange={toggleCheckbox} />
    </span>
  );

  // Render popover content
  const renderPopoverContent = () => (
    <div style={{ width: '300px' }}>
      <PopoverSection
        title={t('Longitude & Latitude columns')}
        isSelected={type === spatialTypes.latlong}
        onSelect={() => handleTypeChange(spatialTypes.latlong)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            {t('Longitude')}
            {renderSelect('lonCol', spatialTypes.latlong)}
          </Col>
          <Col xs={24} md={12}>
            {t('Latitude')}
            {renderSelect('latCol', spatialTypes.latlong)}
          </Col>
        </Row>
      </PopoverSection>
      <PopoverSection
        title={t('Delimited long & lat single column')}
        info={t(
          'Multiple formats accepted, look the geopy.points ' +
            'Python library for more details',
        )}
        isSelected={type === spatialTypes.delimited}
        onSelect={() => handleTypeChange(spatialTypes.delimited)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            {t('Column')}
            {renderSelect('lonlatCol', spatialTypes.delimited)}
          </Col>
          <Col xs={24} md={12}>
            {renderReverseCheckbox()}
          </Col>
        </Row>
      </PopoverSection>
      <PopoverSection
        title={t('Geohash')}
        isSelected={type === spatialTypes.geohash}
        onSelect={() => handleTypeChange(spatialTypes.geohash)}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            {t('Column')}
            {renderSelect('geohashCol', spatialTypes.geohash)}
          </Col>
          <Col xs={24} md={12}>
            {renderReverseCheckbox()}
          </Col>
        </Row>
      </PopoverSection>
    </div>
  );

  // Update state when select values change
  useEffect(() => {
    handleChange();
  }, [
    type,
    latCol,
    lonCol,
    lonlatCol,
    delimiter,
    reverseCheckbox,
    geohashCol,
    handleChange,
  ]);

  return (
    <div>
      <ControlHeader {...props} />
      <Popover
        content={renderPopoverContent()}
        placement="topLeft" // so that popover doesn't move when label changes
        trigger="click"
      >
        <Label className="pointer">{renderLabelContent()}</Label>
      </Popover>
    </div>
  );
};

SpatialControl.propTypes = propTypes;
SpatialControl.defaultProps = defaultProps;

export default SpatialControl;
