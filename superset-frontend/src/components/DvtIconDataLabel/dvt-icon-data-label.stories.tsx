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
import { SupersetTheme } from '@superset-ui/core';
import DvtIconDataLabel, { DvtIconDataLabelProps } from '.';

export default {
  title: 'Dvt-Components/DvtIconDataLabel',
  component: DvtIconDataLabel,
};

export const Default = (args: DvtIconDataLabelProps) => (
  <div
    css={(theme: SupersetTheme) => ({
      height: '100vh',
      backgroundColor: theme.colors.dvt.grayscale.light2,
    })}
  >
    <DvtIconDataLabel {...args} />
  </div>
);

Default.args = {
  label: 'No Data',
};

export const ButtonExample = (args: DvtIconDataLabelProps) => (
  <div
    css={(theme: SupersetTheme) => ({
      height: '100vh',
      backgroundColor: theme.colors.dvt.grayscale.light2,
    })}
  >
    <DvtIconDataLabel {...args} />
  </div>
);

ButtonExample.args = {
  label: 'No Alerts Yet',
  buttonLabel: 'Alert',
};
export const SquareIcon = (args: DvtIconDataLabelProps) => (
  <div
    css={(theme: SupersetTheme) => ({
      height: '100vh',
      backgroundColor: theme.colors.dvt.grayscale.light2,
    })}
  >
    <DvtIconDataLabel {...args} />
  </div>
);

SquareIcon.args = {
  icon: 'square',
  label: 'Select Dataset Source',
};

export const LabelAndDescription = (args: DvtIconDataLabelProps) => (
  <div
    css={(theme: SupersetTheme) => ({
      height: '100vh',
      backgroundColor: theme.colors.dvt.grayscale.light2,
    })}
  >
    <DvtIconDataLabel {...args} />
  </div>
);

LabelAndDescription.args = {
  label: 'Select Dataset Source',
  description:
    'You can create a new chart or use existing ones from the panel on the right',
  icon: 'square',
};
