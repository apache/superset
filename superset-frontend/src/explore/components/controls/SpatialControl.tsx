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
import { useState, useCallback, useEffect, type ReactNode } from 'react';
import {
  Row,
  Col,
  Checkbox,
  Label,
  Popover,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core';

import PopoverSection from '@superset-ui/core/components/PopoverSection';
import ControlHeader from '../ControlHeader';
import SelectControl from './SelectControl';

const spatialTypes = {
  latlong: 'latlong',
  delimited: 'delimited',
  geohash: 'geohash',
} as const;

type SpatialType = (typeof spatialTypes)[keyof typeof spatialTypes];

interface SpatialValue {
  type: SpatialType;
  latCol?: string;
  lonCol?: string;
  lonlatCol?: string;
  delimiter?: string;
  reverseCheckbox?: boolean;
  geohashCol?: string;
}

interface SpatialControlProps {
  onChange?: (value: SpatialValue, errors: string[]) => void;
  value?: SpatialValue;
  animation?: boolean;
  choices?: [string, string][];
  // ControlHeader props that may be passed through
  name?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export default function SpatialControl({
  onChange = () => {},
  value: propValue,
  choices = [],
  name,
  label,
  description,
}: SpatialControlProps): JSX.Element {
  const v = propValue || ({} as SpatialValue);
  const defaultCol = choices.length > 0 ? choices[0][0] : undefined;

  const [type, setTypeState] = useState<SpatialType>(
    v.type || spatialTypes.latlong,
  );
  const [delimiter, setDelimiter] = useState(v.delimiter || ',');
  const [latCol, setLatCol] = useState<string | undefined>(
    v.latCol || defaultCol,
  );
  const [lonCol, setLonCol] = useState<string | undefined>(
    v.lonCol || defaultCol,
  );
  const [lonlatCol, setLonlatCol] = useState<string | undefined>(
    v.lonlatCol || defaultCol,
  );
  const [reverseCheckbox, setReverseCheckbox] = useState(
    v.reverseCheckbox || false,
  );
  const [geohashCol, setGeohashCol] = useState<string | undefined>(
    v.geohashCol || defaultCol,
  );

  const computeValueAndErrors = useCallback((): {
    value: SpatialValue;
    errors: string[];
  } => {
    const computedValue: SpatialValue = { type };
    const errors: string[] = [];
    const errMsg = t('Invalid lat/long configuration.');

    if (type === spatialTypes.latlong) {
      computedValue.latCol = latCol;
      computedValue.lonCol = lonCol;
      if (!lonCol || !latCol) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.delimited) {
      computedValue.lonlatCol = lonlatCol;
      computedValue.delimiter = delimiter;
      computedValue.reverseCheckbox = reverseCheckbox;
      if (!lonlatCol || !delimiter) {
        errors.push(errMsg);
      }
    } else if (type === spatialTypes.geohash) {
      computedValue.geohashCol = geohashCol;
      computedValue.reverseCheckbox = reverseCheckbox;
      if (!geohashCol) {
        errors.push(errMsg);
      }
    }

    return { value: computedValue, errors };
  }, [type, latCol, lonCol, lonlatCol, delimiter, reverseCheckbox, geohashCol]);

  useEffect(() => {
    const { value: computedValue, errors } = computeValueAndErrors();
    onChange(computedValue, errors);
  }, [computeValueAndErrors, onChange]);

  const setType = useCallback((newType: SpatialType): void => {
    setTypeState(newType);
  }, []);

  const toggleCheckbox = useCallback((): void => {
    setReverseCheckbox(prev => !prev);
  }, []);

  const { errors } = computeValueAndErrors();

  const renderLabelContent = (): string | null => {
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

  const renderSelect = (
    name: 'latCol' | 'lonCol' | 'lonlatCol' | 'geohashCol' | 'delimiter',
    selectType: SpatialType,
  ): ReactNode => {
    const stateMap: Record<string, string | undefined> = {
      latCol,
      lonCol,
      lonlatCol,
      geohashCol,
      delimiter,
    };
    const setterMap: Record<
      string,
      React.Dispatch<React.SetStateAction<string | undefined>>
    > = {
      latCol: setLatCol,
      lonCol: setLonCol,
      lonlatCol: setLonlatCol,
      geohashCol: setGeohashCol,
      delimiter: setDelimiter as React.Dispatch<
        React.SetStateAction<string | undefined>
      >,
    };

    return (
      <SelectControl
        ariaLabel={name}
        name={name}
        choices={choices}
        value={stateMap[name]}
        clearable={false}
        onFocus={() => {
          setType(selectType);
        }}
        onChange={(selectValue: string) => {
          setterMap[name](selectValue);
        }}
      />
    );
  };

  const renderReverseCheckbox = (): ReactNode => (
    <span>
      {t('Reverse lat/long ')}
      <Checkbox checked={reverseCheckbox} onChange={toggleCheckbox} />
    </span>
  );

  const renderPopoverContent = (): ReactNode => (
    <div style={{ width: '300px' }}>
      <PopoverSection
        title={t('Longitude & Latitude columns')}
        isSelected={type === spatialTypes.latlong}
        onSelect={() => setType(spatialTypes.latlong)}
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
        onSelect={() => setType(spatialTypes.delimited)}
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
        onSelect={() => setType(spatialTypes.geohash)}
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

  return (
    <div>
      <ControlHeader name={name} label={label} description={description} />
      <Popover
        content={renderPopoverContent()}
        placement="topLeft"
        trigger="click"
      >
        <Label className="pointer">{renderLabelContent()}</Label>
      </Popover>
    </div>
  );
}
