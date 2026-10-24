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
import { ChangeEvent, useState } from 'react';
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
  disableQueryCostWarning,
  formatWarningBytes,
  getCostWarningUnit,
  getQueryCostWarning,
  getQueryCostWarningError,
  isQueryCostWarningMetric,
  isQueryCostWarningThreshold,
  queryCostWarningMetrics,
  parseWarningBytes,
} from '../queryCostWarning';
import { no_margin_bottom, StyledInputContainer } from './styles';

/** Edit a native warning threshold while keeping display units out of saved extras. */
export default function QueryCostWarningSettings({
  extra,
  metric,
  onChange,
}: {
  extra: ExtraJson;
  metric?: QueryCostWarningMetric | null;
  onChange: (rule: Record<string, unknown>) => void;
}) {
  const theme = useTheme();
  const rule = getQueryCostWarning(extra);
  const enabled = rule.enabled === true;
  const definition = isQueryCostWarningMetric(metric)
    ? queryCostWarningMetrics[metric]
    : undefined;
  const flagsEnabled = isFeatureEnabled(FeatureFlag.SqlLabQueryCostWarnings);
  const estimationFlag = isFeatureEnabled(FeatureFlag.EstimateQueryCost);
  const active =
    flagsEnabled &&
    estimationFlag &&
    extra.cost_estimate_enabled === true &&
    !!definition;
  const [unit, setUnit] = useState<CostWarningUnit>(() =>
    getCostWarningUnit(rule.threshold),
  );
  const [draft, setDraft] = useState<string>();
  const matchingThreshold =
    definition &&
    rule.metric === metric &&
    typeof rule.threshold === 'number' &&
    Number.isFinite(rule.threshold)
      ? rule.threshold
      : undefined;
  const value =
    draft ??
    (matchingThreshold === undefined
      ? ''
      : definition?.usesByteUnits
        ? formatWarningBytes(matchingThreshold, unit)
        : String(matchingThreshold));
  const draftInvalid =
    draft !== undefined &&
    (definition?.usesByteUnits
      ? parseWarningBytes(draft, unit) === undefined
      : draft.trim() === '' ||
        !Number.isFinite(Number(draft)) ||
        Number(draft) <= 0);
  const error = draftInvalid
    ? definition?.usesByteUnits
      ? t(
          'Enter an amount that equals positive whole bytes, no greater than 9,007,199,254,740,991.',
        )
      : t('Enter a positive, finite warning threshold.')
    : getQueryCostWarningError(rule, metric);
  const setEnabled = (event: CheckboxChangeEvent) => {
    setDraft(undefined);
    onChange(
      event.target.checked
        ? {
            ...rule,
            enabled: true,
            metric,
            ...(rule.metric !== metric && { threshold: undefined }),
          }
        : disableQueryCostWarning(rule),
    );
  };
  const changeAmount = (event: ChangeEvent<HTMLInputElement>) => {
    if (!isQueryCostWarningMetric(metric)) return;
    const input = event.target.value;
    setDraft(input);
    const threshold = definition?.usesByteUnits
      ? parseWarningBytes(input, unit)
      : Number(input);
    const updatedRule = { ...rule };
    updatedRule.metric = metric;
    delete updatedRule.threshold;
    if (isQueryCostWarningThreshold(threshold, metric)) {
      updatedRule.threshold = threshold;
    }
    onChange(updatedRule);
  };
  const inactiveReason = !definition
    ? t('This engine does not support pre-run warnings.')
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
        {definition && (enabled || matchingThreshold !== undefined) && (
          <Form.Item
            css={no_margin_bottom}
            validateStatus={error ? 'error' : undefined}
            help={error}
          >
            <label htmlFor="query_cost_warning_threshold">
              {definition.thresholdLabel()}
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
              {definition?.usesByteUnits && (
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
            <small>{definition.settingsExplanation()}</small>
          </Form.Item>
        )}
        {error &&
          (!definition || (!enabled && matchingThreshold === undefined)) && (
            <small role="alert">{error}</small>
          )}
        {error && !enabled && (
          <Button
            buttonStyle="link"
            buttonSize="small"
            onClick={() => {
              setDraft(undefined);
              onChange(disableQueryCostWarning(rule));
            }}
          >
            {t('Disable saved rule')}
          </Button>
        )}
      </Flex>
    </StyledInputContainer>
  );
}
