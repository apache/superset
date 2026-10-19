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
import { ChangeEvent, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { useTheme } from '@apache-superset/core/theme';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import {
  Button,
  Checkbox,
  CheckboxChangeEvent,
  Flex,
  Form,
  Input,
  Select,
} from '@superset-ui/core/components';
import { ExtraJson, QueryCostWarningMetric } from '../types';
import {
  CostWarningUnit,
  costWarningUnits,
  formatWarningBytes,
  getCostWarningUnit,
  getQueryCostWarning,
  getQueryCostWarningError,
  parseWarningBytes,
} from './queryCostWarning';
import { no_margin_bottom, StyledInputContainer } from './styles';

/** Edit a native warning threshold while keeping display units out of saved extras. */
export default function QueryCostWarningSettings({
  extra,
  metric,
  onChange,
  onValidationChange,
}: {
  extra: ExtraJson;
  metric?: QueryCostWarningMetric | null;
  onChange: (
    event: CheckboxChangeEvent | ChangeEvent<HTMLInputElement>,
  ) => void;
  onValidationChange?: (hasError: boolean) => void;
}) {
  const theme = useTheme();
  const rule = getQueryCostWarning(extra);
  const enabled = rule.enabled === true;
  const flagsEnabled = isFeatureEnabled(FeatureFlag.SqlLabQueryCostWarnings);
  const estimationFlag = isFeatureEnabled(FeatureFlag.EstimateQueryCost);
  const active =
    flagsEnabled &&
    estimationFlag &&
    extra.cost_estimate_enabled === true &&
    !!metric;
  const [unit, setUnit] = useState<CostWarningUnit>(() =>
    getCostWarningUnit(rule.threshold),
  );
  const [draft, setDraft] = useState<string>();
  const matchingThreshold =
    rule.metric === metric &&
    typeof rule.threshold === 'number' &&
    Number.isFinite(rule.threshold)
      ? rule.threshold
      : undefined;
  const value =
    draft ??
    (matchingThreshold === undefined
      ? ''
      : metric === 'bytes_processed'
        ? formatWarningBytes(matchingThreshold, unit)
        : String(matchingThreshold));
  const draftInvalid =
    draft !== undefined &&
    (metric === 'bytes_processed'
      ? parseWarningBytes(draft, unit) === undefined
      : draft.trim() === '' ||
        !Number.isFinite(Number(draft)) ||
        Number(draft) <= 0);
  const error = draftInvalid
    ? metric === 'bytes_processed'
      ? t(
          'Enter an amount that equals positive whole bytes, no greater than 9,007,199,254,740,991.',
        )
      : t('Enter a positive, finite warning threshold.')
    : getQueryCostWarningError(rule, metric);
  useEffect(() => {
    onValidationChange?.(!!error);
  }, [error, onValidationChange]);

  const setEnabled = (event: CheckboxChangeEvent) => {
    setDraft(undefined);
    onChange(event);
  };
  const changeAmount = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target.value;
    setDraft(input);
    const threshold =
      metric === 'bytes_processed'
        ? parseWarningBytes(input, unit)
        : Number(input);
    onChange({
      target: {
        name: 'query_cost_warning_threshold',
        type: 'number',
        value:
          threshold === undefined ||
          !Number.isFinite(threshold) ||
          threshold <= 0
            ? ''
            : String(threshold),
      },
    } as ChangeEvent<HTMLInputElement>);
  };
  const inactiveReason = !metric
    ? t(
        'This engine does not support pre-run warnings. BigQuery and PostgreSQL are supported.',
      )
    : !flagsEnabled
      ? t('Warnings are inactive because SQLLAB_QUERY_COST_WARNINGS is off.')
      : !estimationFlag
        ? t('Warnings are inactive because ESTIMATE_QUERY_COST is off.')
        : extra.cost_estimate_enabled !== true
          ? t(
              'Enable query cost estimation to activate pre-run warnings. Saved settings are retained.',
            )
          : undefined;

  return (
    <StyledInputContainer css={no_margin_bottom}>
      <div className="input-container">
        <Checkbox
          id="query_cost_warning_enabled"
          name="query_cost_warning_enabled"
          checked={enabled}
          disabled={!active && !enabled}
          onChange={setEnabled}
        >
          {t('Enable pre-run cost warnings')}
        </Checkbox>
      </div>
      <Flex
        vertical
        gap="small"
        css={{ marginInlineStart: theme.sizeUnit * 8 }}
      >
        {inactiveReason && <small>{inactiveReason}</small>}
        {metric && (enabled || matchingThreshold !== undefined) && (
          <Form.Item
            css={no_margin_bottom}
            validateStatus={error ? 'error' : undefined}
            help={error}
          >
            <label htmlFor="query_cost_warning_threshold">
              {metric === 'bytes_processed'
                ? t('Warning threshold (bytes processed)')
                : t('Warning threshold (planner cost)')}
            </label>
            <Flex gap="small">
              <Input
                id="query_cost_warning_threshold"
                name="query_cost_warning_threshold"
                type="number"
                min={0}
                step="any"
                value={value}
                disabled={!active || !enabled}
                aria-invalid={!!error}
                onChange={changeAmount}
              />
              {metric === 'bytes_processed' && (
                <Select
                  ariaLabel={t('Threshold size unit')}
                  value={unit}
                  allowClear={false}
                  css={{ width: theme.sizeUnit * 24, flexShrink: 0 }}
                  options={Object.keys(costWarningUnits).map(value => ({
                    value,
                    label: value === 'Bytes' ? t('Bytes') : value,
                  }))}
                  onChange={selected => {
                    if (
                      selected === 'Bytes' ||
                      selected === 'MB' ||
                      selected === 'GB'
                    ) {
                      setUnit(selected);
                      setDraft(undefined);
                    }
                  }}
                />
              )}
            </Flex>
            <small>
              {metric === 'bytes_processed'
                ? t(
                    'Estimated usage, not a guaranteed bill. 1 MB = 1,000,000 bytes; 1 GB = 1,000,000,000 bytes.',
                  )
                : t(
                    "PostgreSQL's planner cost is relative, not dollars or memory.",
                  )}
            </small>
          </Form.Item>
        )}
        {error &&
          (!metric || (!enabled && matchingThreshold === undefined)) && (
            <small role="alert">{error}</small>
          )}
        {error && !enabled && (
          <Button
            buttonStyle="link"
            buttonSize="small"
            onClick={() => {
              setDraft(undefined);
              onChange({
                target: { name: 'query_cost_warning_enabled', checked: false },
              } as CheckboxChangeEvent);
            }}
          >
            {t('Disable saved rule')}
          </Button>
        )}
      </Flex>
    </StyledInputContainer>
  );
}
