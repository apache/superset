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
import { ReactNode } from 'react';
import { JsonValue } from '@superset-ui/core';
import { ControlComponentProps } from 'src/explore/components/Control';
import { ColumnMeta } from '@superset-ui/chart-controls';

export interface OptionProps {
  children?: ReactNode;
  index: number;
  label?: string;
  tooltipTitle?: string;
  column?: ColumnMeta;
  clickClose: (index: number) => void;
  withCaret?: boolean;
  isExtra?: boolean;
  canDelete?: boolean;
}

export interface OptionItemInterface {
  type: string;
  dragIndex: number;
}

/**
 * Shared control props for all DnD control.
 */
export type DndControlProps<
  ValueType extends JsonValue
> = ControlComponentProps<ValueType | ValueType[] | null> & {
  multi?: boolean;
  canDelete?: boolean;
  ghostButtonText?: string;
  onChange: (value: ValueType | ValueType[] | null | undefined) => void;
};

export type OptionValueType = Record<string, any>;
