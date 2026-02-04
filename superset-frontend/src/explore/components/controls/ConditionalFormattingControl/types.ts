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
import { PopoverProps } from '@superset-ui/core/components/Popover';
import {
  Comparator,
  ControlComponentProps,
  ObjectFormattingEnum,
} from '@superset-ui/chart-controls';
import { GenericDataType } from '@apache-superset/core/api/core';

export type ConditionalFormattingConfig = {
  operator?: Comparator;
  targetValue?: number;
  targetValueLeft?: number;
  targetValueRight?: number;
  column?: string;
  colorScheme?: string;
  toAllRow?: boolean;
  toTextColor?: boolean;
  useGradient?: boolean;
  columnFormatting?: string;
  objectFormatting?: ObjectFormattingEnum;
};

export type ConditionalFormattingControlProps = ControlComponentProps<
  ConditionalFormattingConfig[]
> & {
  columnOptions: ColumnOption[];
  removeIrrelevantConditions: boolean;
  verboseMap: Record<string, string>;
  label: string;
  description: string;
  extraColorChoices?: { label: string; value: string }[];
  allColumns?: ColumnOption[];
};

export type FormattingPopoverProps = PopoverProps & {
  columns: ColumnOption[];
  onChange: (value: ConditionalFormattingConfig) => void;
  config?: ConditionalFormattingConfig;
  title: string;
  children: ReactNode;
  extraColorChoices?: { label: string; value: string }[];
  allColumns?: ColumnOption[];
};

export interface ColumnOption {
  label: string;
  value: string;
  dataType: GenericDataType;
}
