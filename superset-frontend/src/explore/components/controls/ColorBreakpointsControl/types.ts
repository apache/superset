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
import { OptionValueType } from 'src/explore/components/controls/DndColumnSelectControl/types';
import { ControlComponentProps } from 'src/explore/components/Control';

export interface ColorType {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ColorBreakpointType {
  color?: ColorType;
  minValue?: number;
  maxValue?: number;
}

export interface ErrorMapType {
  color: string[];
  minValue: string[];
  maxValue: string[];
}

export interface ColorBreakpointsControlProps
  extends ControlComponentProps<OptionValueType[]> {
  contours?: {};
}

export interface ColorBreakpointsPopoverTriggerProps {
  description?: string;
  hovered?: boolean;
  value?: ColorBreakpointType;
  children?: ReactNode;
  saveColorBreakpoint: (gradientBreakpoint: ColorBreakpointType) => void;
  isControlled?: boolean;
  visible?: boolean;
  toggleVisibility?: (visibility: boolean) => void;
}

export interface ColorBreakpointsPopoverControlProps {
  description?: string;
  hovered?: boolean;
  value?: ColorBreakpointType;
  onSave?: (gradientBreakpoint: ColorBreakpointType) => void;
  onClose?: () => void;
}

export interface ColorBreakpointOptionProps {
  gradientBreakpoint: ColorBreakpointType;
  index: number;
  saveGradientBreakpoint: (gradientBreakpoint: ColorBreakpointType) => void;
  onClose: (index: number) => void;
  onShift: (hoverIndex: number, dragIndex: number) => void;
}
