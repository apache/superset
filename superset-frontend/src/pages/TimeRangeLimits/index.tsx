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
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { getClientErrorObject, SupersetClient } from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Descriptions,
  Divider,
  Flex,
  Loading,
  Switch,
  Typography,
} from '@superset-ui/core/components';
import SubMenu from 'src/features/home/SubMenu';
import { limitAlertIcon } from 'src/components/TimeRangeLimits/limitAlertIcon';
import {
  describeRuleValue,
  RULE_NAMES,
  RuleName,
  RuleValue,
  ruleLabels as ruleLabelsFor,
} from 'src/utils/timeRangeLimits';

interface LimitsPayload {
  policy: Record<RuleName, RuleValue | null>;
  display_labels: Record<RuleName, string | null>;
  eligible_time_grains: { value: string; label: string }[];
}

interface Failure {
  attempt: number;
  unitValue?: string;
}

interface PageState {
  pending: boolean;
  payload?: LimitsPayload;
  failure?: Failure;
}

const PanelContainer = styled.section`
  ${({ theme }) => css`
    margin: 0 ${theme.sizeUnit * 3}px ${theme.sizeUnit * 6}px;
    background-color: ${theme.colorBgContainer};
    padding: ${theme.sizeUnit * 4}px;
  `}
`;

const SWITCH_LABEL_ID = 'time-range-limits-switch-label';
const SWITCH_HELPER_ID = 'time-range-limits-switch-helper';

async function unitValueOf(response: unknown): Promise<string | undefined> {
  const { errors } = await getClientErrorObject(
    response as Parameters<typeof getClientErrorObject>[0],
  );
  const extra = errors?.[0]?.extra;
  return typeof extra?.field === 'string' &&
    extra.field.endsWith('.time_grain') &&
    extra.value !== undefined
    ? String(extra.value)
    : undefined;
}

export default function TimeRangeLimits() {
  const [state, setState] = useState<PageState>({ pending: true });
  const regionRef = useRef<HTMLElement>(null);
  const fromRetry = useRef(false);
  const { pending, payload, failure } = state;
  const attempt = failure?.attempt;
  const ruleLabels = ruleLabelsFor();

  const load = useCallback(() => {
    setState(previous => ({ ...previous, pending: true }));
    SupersetClient.get({
      endpoint: '/api/v1/time_range_limits/',
      timeout: 10000,
      fetchRetryOptions: { retries: 0 },
    })
      .then(({ json }) =>
        setState({
          pending: false,
          payload: (json as { result: LimitsPayload }).result,
        }),
      )
      .catch(async response => {
        const unitValue = await unitValueOf(response);
        setState(previous => ({
          pending: false,
          failure: {
            attempt: (previous.failure?.attempt ?? 0) + 1,
            unitValue,
          },
        }));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (fromRetry.current && attempt) {
      regionRef.current
        ?.querySelector<HTMLButtonElement>('[role="alert"] button')
        ?.focus();
    }
  }, [attempt]);

  useEffect(() => {
    if (fromRetry.current && payload) {
      regionRef.current?.focus();
    }
  }, [payload]);

  const retry = () => {
    fromRetry.current = true;
    load();
  };

  const anyRuleSet = payload
    ? RULE_NAMES.some(name => payload.policy[name] !== null)
    : false;

  return (
    <>
      <SubMenu
        name={
          // eslint-disable-next-line jsx-a11y/prefer-tag-over-role
          <span role="heading" aria-level={1}>
            {t('Time range limits')}
          </span>
        }
      />
      <PanelContainer
        ref={regionRef}
        aria-label={t('Time range limits')}
        aria-busy={pending || undefined}
        tabIndex={-1}
      >
        {pending && !payload && !failure && (
          <Loading position="inline-centered" />
        )}
        {failure && (
          <Alert
            key={failure.attempt}
            type="error"
            icon={limitAlertIcon('error')}
            closable={false}
            message={t(
              'Time range limits could not be loaded. Queries are paused to protect the database.',
            )}
            description={
              failure.unitValue
                ? t(
                    'Configured time grain %(value)s is no longer available. Select a supported unit.',
                    { value: failure.unitValue },
                  )
                : undefined
            }
            action={
              <Button buttonSize="small" loading={pending} onClick={retry}>
                {t('Retry')}
              </Button>
            }
          />
        )}
        {payload && (
          <>
            <Flex gap="small" align="start">
              <Switch
                disabled
                checked={anyRuleSet}
                aria-labelledby={SWITCH_LABEL_ID}
                aria-describedby={SWITCH_HELPER_ID}
              />
              <Flex vertical>
                <Typography.Text strong id={SWITCH_LABEL_ID}>
                  {t('Limit time ranges on all dashboards')}
                </Typography.Text>
                <Typography.Text type="secondary" id={SWITCH_HELPER_ID}>
                  {t(
                    'Set in the deployment configuration. Changing it needs a restart.',
                  )}
                </Typography.Text>
              </Flex>
            </Flex>
            <Divider />
            <Descriptions layout="vertical" column={2} colon={false}>
              {RULE_NAMES.map(name => {
                const rule = payload.policy[name];
                const duration = payload.display_labels[name];
                return (
                  <Descriptions.Item key={name} label={ruleLabels[name]}>
                    {rule && duration
                      ? describeRuleValue(name, rule, duration)
                      : t('No limit')}
                  </Descriptions.Item>
                );
              })}
              <Descriptions.Item label={t('Dashboard editors')}>
                {t('Can make limits stricter, never looser')}
              </Descriptions.Item>
            </Descriptions>
            <Typography.Text type="secondary">
              {t(
                "Limits of a day or longer count whole calendar days, from midnight in the server's time zone.",
              )}
            </Typography.Text>
            {payload.eligible_time_grains.length === 0 && (
              <Typography.Text type="secondary">
                {t('No eligible time grains configured')}
              </Typography.Text>
            )}
          </>
        )}
      </PanelContainer>
    </>
  );
}
