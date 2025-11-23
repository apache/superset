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
import { t } from '@superset-ui/core';
import { IntegerInputControl } from './IntegerInputControl';

/**
 * React component-based control for Word Cloud minimum font size.
 * This is a proper React functional component that renders actual UI,
 * replacing the legacy configuration object approach.
 */
export const SizeFromControl: React.FC<
  React.ComponentProps<typeof IntegerInputControl>
> = props => {
  const {
    name,
    label,
    description,
    default: defaultValue,
    ...restProps
  } = props;
  return (
    <IntegerInputControl
      name={name || 'size_from'}
      label={label || t('Minimum Font Size')}
      description={
        description || t('Font size for the smallest value in the list')
      }
      default={defaultValue ?? 10}
      config={{
        defaultName: 'size_from',
        defaultLabel: t('Minimum Font Size'),
        defaultDescription: t('Font size for the smallest value in the list'),
        defaultValue: 10,
      }}
      {...restProps}
    />
  );
};

// Set default props for control name extraction
SizeFromControl.defaultProps = {
  name: 'size_from',
};
