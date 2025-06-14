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

export interface ContourType extends OptionValueType {
  color?: ColorType | undefined;
  lowerThreshold?: any | undefined;
  upperThreshold?: any | undefined;
  strokeWidth?: any | undefined;
}

export interface ErrorMapType {
  lowerThreshold: string[];
  upperThreshold: string[];
  strokeWidth: string[];
  color: string[];
}

export interface ContourControlProps
  extends ControlComponentProps<OptionValueType[]> {
  contours?: {};
}

export interface ContourPopoverTriggerProps {
  description?: string;
  hovered?: boolean;
  value?: ContourType;
  children?: ReactNode;
  saveContour: (contour: ContourType) => void;
  isControlled?: boolean;
  visible?: boolean;
  toggleVisibility?: (visibility: boolean) => void;
}

export interface ContourPopoverControlProps {
  description?: string;
  hovered?: boolean;
  value?: ContourType;
  onSave?: (contour: ContourType) => void;
  onClose?: () => void;
}

export interface ContourOptionProps {
  contour: ContourType;
  index: number;
  saveContour: (contour: ContourType) => void;
  onClose: (index: number) => void;
  onShift: (hoverIndex: number, dragIndex: number) => void;
}
