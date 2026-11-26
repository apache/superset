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
import { t } from '@apache-superset/core/translation';
import { FormItem, Tooltip, Typography } from '@superset-ui/core/components';
import type { CheckboxOptionType } from '@superset-ui/core/components/Radio';
import {
  FieldError,
  FrameLimits,
} from 'src/explore/components/controls/DateFilterControl/types';

export function fieldSlot(
  limits: FrameLimits | undefined,
  error: FieldError | undefined,
  children: ReactNode,
) {
  if (!limits) {
    return children;
  }
  return (
    <FormItem
      validateStatus={
        error || (limits.rowInvalid && !limits.pending) ? 'error' : undefined
      }
      help={
        error && (
          <span id={error.id} role="alert">
            {error.message}
          </span>
        )
      }
    >
      {children}
    </FormItem>
  );
}

export function fieldAria(
  limits: FrameLimits | undefined,
  error: FieldError | undefined,
) {
  if (!limits || limits.pending) {
    return {};
  }
  const describedBy = [error?.id, limits.rowErrorId].filter(Boolean);
  return {
    'aria-invalid': error || limits.rowInvalid ? true : undefined,
    'aria-describedby': describedBy.length ? describedBy.join(' ') : undefined,
  };
}

type PresetReasons = Record<string, ReactNode | undefined> | undefined;

/**
 * The options with the ones that break the limits disabled, each with its
 * reason in a tooltip. The checked option always stays enabled.
 */
export function presetOptions(
  options: CheckboxOptionType[],
  value: string,
  presets: PresetReasons,
  limits?: FrameLimits,
) {
  return options.map(original => {
    const option = {
      ...original,
      'aria-invalid':
        original.value === value ? limits?.presetInvalid : undefined,
      'aria-describedby':
        original.value === value ? limits?.presetDescribedBy : undefined,
    };
    const reason = presets?.[String(option.value)];
    if (!reason || option.value === value) {
      return option;
    }
    return {
      ...option,
      disabled: true,
      label: (
        <Tooltip title={reason} placement="right">
          <span>{option.label}</span>
        </Tooltip>
      ),
    };
  });
}

/**
 * With limits on, the preset group is named by its title and, when some
 * options are disabled, described by a line saying why and by the limit line.
 */
export function presetGroup(
  limits: FrameLimits | undefined,
  options: CheckboxOptionType[],
) {
  if (!limits) {
    return { titleId: undefined, groupProps: {}, note: null };
  }
  const anyDisabled = options.some(option => option.disabled);
  const describedBy = anyDisabled
    ? [limits.disabledPresetsId, limits.limitLineId].filter(Boolean).join(' ')
    : undefined;
  return {
    titleId: limits.groupLabelId,
    groupProps: {
      role: 'radiogroup',
      'aria-labelledby': limits.groupLabelId,
      'aria-describedby': describedBy || undefined,
    },
    note: anyDisabled ? (
      <Typography.Paragraph id={limits.disabledPresetsId}>
        {t('Options outside the time range limit are disabled.')}
      </Typography.Paragraph>
    ) : null,
  };
}

/** The default option, unless the limits rule it out and another option fits. */
export function defaultPreset(
  options: CheckboxOptionType[],
  fallback: string,
  presets: PresetReasons,
): string {
  if (!presets?.[fallback]) {
    return fallback;
  }
  const allowed = options.find(option => !presets[String(option.value)]);
  return allowed ? String(allowed.value) : fallback;
}
