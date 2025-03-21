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
import { useCallback } from 'react';
import { t } from '@superset-ui/core';
import PropTypes from 'prop-types';
import Popover from 'src/components/Popover';
import { decimal2sexagesimal } from 'geolib';

import Label from 'src/components/Label';
import { FormLabel } from 'src/components/Form';
import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';

export const DEFAULT_VIEWPORT = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const PARAMS = ['longitude', 'latitude', 'zoom', 'bearing', 'pitch'];

const propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.shape({
    longitude: PropTypes.number,
    latitude: PropTypes.number,
    zoom: PropTypes.number,
    bearing: PropTypes.number,
    pitch: PropTypes.number,
  }),
  default: PropTypes.object,
  name: PropTypes.string.isRequired,
};

const defaultProps = {
  onChange: () => {},
  default: { type: 'fix', value: 5 },
  value: DEFAULT_VIEWPORT,
};

export default function ViewportControl(props) {
  const { onChange, value, name } = props;

  const handleChange = useCallback(
    (ctrl, ctrlValue) => {
      onChange({
        ...value,
        [ctrl]: ctrlValue,
      });
    },
    [onChange, value],
  );

  const renderTextControl = useCallback(
    ctrl => (
      <div key={ctrl}>
        <FormLabel>{ctrl}</FormLabel>
        <TextControl
          value={value[ctrl]}
          onChange={ctrlValue => handleChange(ctrl, ctrlValue)}
          isFloat
        />
      </div>
    ),
    [value, handleChange],
  );

  const renderPopover = useCallback(
    () => (
      <div id={`filter-popover-${name}`}>
        {PARAMS.map(ctrl => renderTextControl(ctrl))}
      </div>
    ),
    [name, renderTextControl],
  );

  const renderLabel = useCallback(() => {
    if (value.longitude && value.latitude) {
      return `${decimal2sexagesimal(
        value.longitude,
      )} | ${decimal2sexagesimal(value.latitude)}`;
    }
    return 'N/A';
  }, [value.longitude, value.latitude]);

  return (
    <div>
      <ControlHeader {...props} />
      <Popover
        container={document.body}
        trigger="click"
        placement="right"
        content={renderPopover()}
        title={t('Viewport')}
      >
        <Label className="pointer">{renderLabel()}</Label>
      </Popover>
    </div>
  );
}

ViewportControl.propTypes = propTypes;
ViewportControl.defaultProps = defaultProps;
