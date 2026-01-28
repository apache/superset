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
import type { CSSProperties, ReactElement, RefObject, ReactNode } from 'react';
import { IconType } from '../Icons';

/**
 * Container item.
 */
export interface DropdownItem {
  /**
   * String that uniquely identifies the item.
   */
  id: string;
  /**
   * The element to be rendered.
   */
  element: ReactElement;
}

/**
 * Horizontal container that displays overflowed items in a dropdown.
 * It shows an indicator of how many items are currently overflowing.
 */
export interface DropdownContainerProps {
  /**
   * Array of items. The id property is used to uniquely identify
   * the elements when rendering or dealing with event handlers.
   */
  items: DropdownItem[];
  /**
   * Event handler called every time an element moves between
   * main container and dropdown.
   */
  onOverflowingStateChange?: (overflowingState: {
    notOverflowed: string[];
    overflowed: string[];
  }) => void;
  /**
   * Option to customize the content of the dropdown.
   */
  dropdownContent?: (overflowedItems: DropdownItem[]) => ReactElement;
  /**
   * Dropdown ref.
   */
  dropdownRef?: RefObject<HTMLDivElement>;
  /**
   * Dropdown additional style properties.
   */
  dropdownStyle?: CSSProperties;
  /**
   * Displayed count in the dropdown trigger.
   */
  dropdownTriggerCount?: number;
  /**
   * Icon of the dropdown trigger.
   */
  dropdownTriggerIcon?: IconType;
  /**
   * Text of the dropdown trigger.
   */
  dropdownTriggerText?: string;
  /**
   * Text of the dropdown trigger tooltip
   */
  dropdownTriggerTooltip?: ReactNode | null;
  /**
   * Main container additional style properties.
   */
  style?: CSSProperties;
  /**
   * Force render popover content before it's first opened
   */
  forceRender?: boolean;
}

export type DropdownRef = HTMLDivElement & { open: () => void };
