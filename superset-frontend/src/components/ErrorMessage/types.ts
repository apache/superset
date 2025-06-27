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

import type { ReactNode, ComponentType } from 'react';
import type { ErrorSource, SupersetError } from '@superset-ui/core';

export type ErrorMessageComponentProps<ExtraType = Record<string, any> | null> =
  {
    error: SupersetError<ExtraType>;
    source?: ErrorSource;
    subtitle?: ReactNode;
    compact?: boolean;
  };

export type ErrorMessageComponent = ComponentType<ErrorMessageComponentProps>;

export interface ErrorAlertProps {
  errorType?: string; // Strong text on the first line
  message: React.ReactNode | string; // Text shown on the first line
  type?: 'warning' | 'error' | 'info'; // Allows only 'warning' or 'error'
  description?: React.ReactNode; // Text shown under the first line, not collapsible
  descriptionDetails?: React.ReactNode | string; // Text shown under the first line, collapsible
  descriptionDetailsCollapsed?: boolean; // Hides the collapsible section unless "Show more" is clicked, default true
  descriptionPre?: boolean; // Uses pre-style to break lines, default true
  compact?: boolean; // Shows the error icon with tooltip and modal, default false
  children?: React.ReactNode; // Additional content to show in the modal
  closable?: boolean; // Show close button, default true
  showIcon?: boolean; // Show icon, default true
  className?: string;
}
