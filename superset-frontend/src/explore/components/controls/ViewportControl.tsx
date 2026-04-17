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
import { useCallback, type ReactNode } from 'react';
import { t } from '@apache-superset/core';
import { Popover, FormLabel, Label } from '@superset-ui/core/components';
import { decimalToSexagesimal } from 'geolib';

import TextControl from './TextControl';
import ControlHeader from '../ControlHeader';

export interface Viewport {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export const DEFAULT_VIEWPORT: Viewport = {
  longitude: 6.85236157047845,
  latitude: 31.222656842808707,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

const PARAMS: (keyof Viewport)[] = [
  'longitude',
  'latitude',
  'zoom',
  'bearing',
  'pitch',
];

interface ViewportControlProps {
  onChange?: (value: Viewport) => void;
  value?: Viewport;
  default?: Record<string, unknown>;
  name: string;
}

export default function ViewportControl({
  onChange = () => {},
  value = DEFAULT_VIEWPORT,
  name,
  ...restProps
}: ViewportControlProps): JSX.Element {
  const handleChange = useCallback(
    (ctrl: keyof Viewport, ctrlValue: number): void => {
      onChange({
        ...value,
        [ctrl]: ctrlValue,
      });
    },
    [onChange, value],
  );

  const renderTextControl = (ctrl: keyof Viewport): ReactNode => (
    <div key={ctrl}>
      <FormLabel>{ctrl}</FormLabel>
      <TextControl
        value={value?.[ctrl]}
        onChange={(ctrlValue: number) => handleChange(ctrl, ctrlValue)}
        isFloat
      />
    </div>
  );

  const renderPopover = (): ReactNode => (
    <div id={`filter-popover-${name}`}>
      {PARAMS.map(ctrl => renderTextControl(ctrl))}
    </div>
  );

  const renderLabel = (): string => {
    if (value?.longitude && value?.latitude) {
      return `${decimalToSexagesimal(value.longitude)} | ${decimalToSexagesimal(value.latitude)}`;
    }
    return 'N/A';
  };

  return (
    <div>
      <ControlHeader {...restProps} name={name} />
      <Popover
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
