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
import { GenericDataType } from '@superset-ui/core';
import ControlForm, {
  ControlFormRow,
  ControlFormItem,
  ControlFormItemSpec,
} from '../../../components/ControlForm';
import {
  SHARED_COLUMN_CONFIG_PROPS,
  SharedColumnConfigProp,
} from './constants';
import {
  ColumnConfig,
  ColumnConfigFormLayout,
  ColumnConfigInfo,
} from './types';

export type ColumnConfigPopoverProps = {
  column: ColumnConfigInfo;
  configFormLayout: ColumnConfigFormLayout;
  onChange: (value: ColumnConfig) => void;
};

export default function ColumnConfigPopover({
  column,
  configFormLayout,
  onChange,
}: ColumnConfigPopoverProps) {
  return (
    <ControlForm onChange={onChange} value={column.config}>
      {configFormLayout[
        column.type === undefined ? GenericDataType.STRING : column.type
      ].map((row, i) => (
        <ControlFormRow key={i}>
          {row.map(meta => {
            const key = typeof meta === 'string' ? meta : meta.name;
            const override =
              typeof meta === 'string'
                ? {}
                : 'override' in meta
                ? meta.override
                : meta.config;
            const props = {
              ...(key in SHARED_COLUMN_CONFIG_PROPS
                ? SHARED_COLUMN_CONFIG_PROPS[key as SharedColumnConfigProp]
                : undefined),
              ...override,
            } as ControlFormItemSpec;
            return <ControlFormItem key={key} name={key} {...props} />;
          })}
        </ControlFormRow>
      ))}
    </ControlForm>
  );
}
