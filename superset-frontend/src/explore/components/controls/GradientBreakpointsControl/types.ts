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

export interface GradientBreakpointType {
  color?: ColorType | undefined;
  minValue?: any | undefined;
  maxValue?: any | undefined;
}

export interface ErrorMapType {
  color: string[];
  minValue: string[];
  maxValue: string[];
}

export interface GradientBreakpointsControlProps
  extends ControlComponentProps<OptionValueType[]> {
  contours?: {};
}

export interface GradientBreakpointsPopoverTriggerProps {
  description?: string;
  hovered?: boolean;
  value?: GradientBreakpointType;
  children?: ReactNode;
  saveGradientBreakpoint: (gradientBreakpoint: GradientBreakpointType) => void;
  isControlled?: boolean;
  visible?: boolean;
  toggleVisibility?: (visibility: boolean) => void;
}

export interface GradientBreakpointsPopoverControlProps {
  description?: string;
  hovered?: boolean;
  value?: GradientBreakpointType;
  onSave?: (gradientBreakpoint: GradientBreakpointType) => void;
  onClose?: () => void;
}

export interface GradientBreakpointOptionProps {
  gradientBreakpoint: GradientBreakpointType;
  index: number;
  saveGradientBreakpoint: (gradientBreakpoint: GradientBreakpointType) => void;
  onClose: (index: number) => void;
  onShift: (hoverIndex: number, dragIndex: number) => void;
}
