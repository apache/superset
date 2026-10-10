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
import { FeatureFlag } from '@superset-ui/core';
import AccessSection from './AccessSection';

export default {
  title: 'Features/Dashboard/AccessSection',
  component: AccessSection,
  parameters: {
    docs: {
      description: {
        component:
          'The AccessSection component renders access control fields in the dashboard properties modal. It shows Editors and Tags pickers. When the ENABLE_VIEWERS feature flag is on, it also shows a Viewers picker.',
      },
    },
  },
};

const sampleEditors = [
  { id: 10, name: 'Alice Smith', label: 'Alice Smith', type: 1 },
  { id: 11, name: 'Dashboard Editors', label: 'Dashboard Editors', type: 2 },
];

const sampleViewers = [
  { id: 20, name: 'Data Engineering', label: 'Data Engineering', type: 3 },
  { id: 21, name: 'Bob Johnson', label: 'Bob Johnson', type: 1 },
];

const sampleTags = [
  { id: 1, name: 'Production' },
  { id: 2, name: 'Finance' },
];

const noopFn = () => {};

const baseProps = {
  isLoading: false,
  tags: sampleTags,
  editors: sampleEditors,
  viewers: sampleViewers,
  onChangeEditors: noopFn,
  onChangeViewers: noopFn,
  onChangeTags: noopFn,
  onClearTags: noopFn,
};

/**
 * Helper decorator that sets feature flags on window.featureFlags
 * for the duration of the story.
 */
const withFeatureFlags =
  (flags: Partial<Record<string, boolean>>) => (Story: () => JSX.Element) => {
    const prev = window.featureFlags || {};
    window.featureFlags = { ...prev, ...flags };
    return <Story />;
  };

export const EditorsOnly = () => <AccessSection {...baseProps} />;
EditorsOnly.decorators = [
  withFeatureFlags({
    [FeatureFlag.EnableViewers]: false,
    [FeatureFlag.TaggingSystem]: false,
  }),
];
EditorsOnly.parameters = {
  docs: {
    description: {
      story:
        'Default mode with no optional flags. Shows only the Editors field.',
    },
  },
};

export const EditorsWithTags = () => <AccessSection {...baseProps} />;
EditorsWithTags.decorators = [
  withFeatureFlags({
    [FeatureFlag.EnableViewers]: false,
    [FeatureFlag.TaggingSystem]: true,
  }),
];
EditorsWithTags.parameters = {
  docs: {
    description: {
      story:
        'Editors with TaggingSystem enabled. Shows Editors and Tags fields.',
    },
  },
};

export const EditorsAndViewers = () => <AccessSection {...baseProps} />;
EditorsAndViewers.decorators = [
  withFeatureFlags({
    [FeatureFlag.EnableViewers]: true,
    [FeatureFlag.TaggingSystem]: true,
  }),
];
EditorsAndViewers.parameters = {
  docs: {
    description: {
      story:
        'Full mode with ENABLE_VIEWERS on. Shows Editors, Viewers, and Tags fields.',
    },
  },
};

export const EditorsAndViewersNoTags = () => <AccessSection {...baseProps} />;
EditorsAndViewersNoTags.decorators = [
  withFeatureFlags({
    [FeatureFlag.EnableViewers]: true,
    [FeatureFlag.TaggingSystem]: false,
  }),
];
EditorsAndViewersNoTags.parameters = {
  docs: {
    description: {
      story:
        'ENABLE_VIEWERS on without TaggingSystem. Shows only Editors and Viewers fields.',
    },
  },
};

export const LoadingState = () => (
  <AccessSection {...baseProps} isLoading tags={[]} editors={[]} viewers={[]} />
);
LoadingState.decorators = [
  withFeatureFlags({
    [FeatureFlag.EnableViewers]: true,
  }),
];
LoadingState.parameters = {
  docs: {
    description: {
      story: 'Loading state with disabled inputs.',
    },
  },
};
