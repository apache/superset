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
import type { HTMLAttributes, ReactNode, RefObject } from 'react';

export type ScrollToBottomPosition = 'bottom-right' | 'bottom-left';

export interface ScrollToBottomButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  threshold?: number;
  tooltip?: string;
  position?: ScrollToBottomPosition;
  className?: string;
  'data-test'?: string;
}

export interface ScrollToBottomContainerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children: ReactNode;
  threshold?: number;
  tooltip?: string;
  position?: ScrollToBottomPosition;
  containerRef?: RefObject<HTMLDivElement | null>;
}
