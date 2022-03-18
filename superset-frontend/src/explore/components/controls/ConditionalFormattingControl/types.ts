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
import { PopoverProps } from 'antd/lib/popover';
import { ControlComponentProps } from '@superset-ui/chart-controls';

export enum COMPARATOR {
  NONE = 'None',
  GREATER_THAN = '>',
  LESS_THAN = '<',
  GREATER_OR_EQUAL = '≥',
  LESS_OR_EQUAL = '≤',
  EQUAL = '=',
  NOT_EQUAL = '≠',
  BETWEEN = '< x <',
  BETWEEN_OR_EQUAL = '≤ x ≤',
  BETWEEN_OR_LEFT_EQUAL = '≤ x <',
  BETWEEN_OR_RIGHT_EQUAL = '< x ≤',
}

export const MULTIPLE_VALUE_COMPARATORS = [
  COMPARATOR.BETWEEN,
  COMPARATOR.BETWEEN_OR_EQUAL,
  COMPARATOR.BETWEEN_OR_LEFT_EQUAL,
  COMPARATOR.BETWEEN_OR_RIGHT_EQUAL,
];

export type ConditionalFormattingConfig = {
  operator?: COMPARATOR;
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  column?: string;
  colorScheme?: string;
};

export type ConditionalFormattingControlProps = ControlComponentProps<
  ConditionalFormattingConfig[]
> & {
  columnOptions: { label: string; value: string }[];
  verboseMap: Record<string, string>;
  label: string;
  description: string;
};

export type FormattingPopoverProps = PopoverProps & {
  columns: { label: string; value: string }[];
  onChange: (value: ConditionalFormattingConfig) => void;
  config?: ConditionalFormattingConfig;
  title: string;
  children: ReactNode;
};
