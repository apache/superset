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
import { RefObject, useEffect, useMemo, useState } from 'react';
import { Alert } from '@apache-superset/core/components';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  Col,
  Flex,
  RefSelectProps,
  Row,
  Select,
  Switch,
  Typography,
} from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { RefreshFrequencySelect } from '../../RefreshFrequency/RefreshFrequencySelect';
import {
  formatBound,
  getAllowedRefreshOptions,
  getBoundSeconds,
  getRefreshFrequencyOptions,
  getStandardSeconds,
  isPlainObject,
  MAXIMUM_KEY,
  MINIMUM_KEY,
  POLICY_KEY,
  RefreshBound,
  RefreshBoundKey,
  toBound,
} from '../../RefreshFrequency';
import {
  ALLOWED_FIELD,
  FREQUENCY_FIELD,
  isPolicyOn,
  isRefreshPolicyAllowed,
  MAXIMUM_FIELD,
  MINIMUM_FIELD,
} from '../hooks/useRefreshPolicy';

const NO_LIMIT = 'no_limit';

const errorId = (field: string) =>
  `dashboard-refresh-error-${field.replace(/\./g, '-')}`;
const warningId = (field: string) =>
  `dashboard-refresh-warning-${field.replace(/\./g, '-')}`;
const noteId = (field: string) =>
  `dashboard-refresh-note-${field.replace(/\./g, '-')}`;

const describedBy = (...ids: (string | false | undefined)[]) =>
  ids.filter(Boolean).join(' ') || undefined;

const HelperText = styled(Typography.Text)`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
`;

interface RefreshSectionProps {
  policyEnabled?: boolean;
  refreshFrequency: number;
  onRefreshFrequencyChange: (value: number) => void;
  policy?: unknown;
  errors?: Record<string, string>;
  warnings?: Record<string, string>;
  adminList?: unknown;
  onPolicyOnChange?: (on: boolean) => void;
  onAllowedChange?: (on: boolean) => void;
  onBoundChange?: (key: RefreshBoundKey, seconds: number | null) => void;
  allowedRef?: RefObject<HTMLDivElement>;
  frequencyRef?: RefObject<HTMLDivElement>;
  minimumRef?: RefObject<RefSelectProps>;
  maximumRef?: RefObject<RefSelectProps>;
}

const ErrorRegion = ({
  messages,
}: {
  messages: { field: string; message?: string }[];
}) => (
  <div role="alert">
    {messages.map(({ field, message }) =>
      message ? (
        <Typography.Text key={field} type="danger" id={errorId(field)}>
          {message}
        </Typography.Text>
      ) : null,
    )}
  </div>
);

const RefreshSection = ({
  policyEnabled = true,
  refreshFrequency,
  onRefreshFrequencyChange,
  policy,
  errors = {},
  warnings = {},
  adminList,
  onPolicyOnChange = () => {},
  onAllowedChange = () => {},
  onBoundChange = () => {},
  allowedRef,
  frequencyRef,
  minimumRef,
  maximumRef,
}: RefreshSectionProps) => {
  const policyOn = isPolicyOn(policy);
  const policyObject = isPlainObject(policy) ? policy : undefined;
  const allowed = isRefreshPolicyAllowed(policy);
  const frequencyError = errors[FREQUENCY_FIELD];
  const prohibited = Boolean(policyObject) && !allowed;
  const prohibitedNeedsFrequency =
    prohibited && (refreshFrequency !== 0 || Boolean(frequencyError));
  // Once shown while prohibited, the field stays until Allow or the policy
  // changes, so picking "Don't refresh" doesn't unmount the focused radio.
  const [prohibitedFrequencyShown, setProhibitedFrequencyShown] =
    useState(false);
  useEffect(() => {
    if (!prohibited) {
      setProhibitedFrequencyShown(false);
    } else if (prohibitedNeedsFrequency) {
      setProhibitedFrequencyShown(true);
    }
  }, [prohibited, prohibitedNeedsFrequency]);
  const showFrequency =
    allowed || prohibitedNeedsFrequency || prohibitedFrequencyShown;

  const standardOptions = useMemo(() => {
    const labels = getRefreshFrequencyOptions(adminList);
    return getStandardSeconds(adminList).map(value => ({
      value,
      label:
        labels.find(option => option.value === value)?.label ??
        formatBound(toBound(value)),
    }));
  }, [adminList]);

  const defaultOptions = useMemo((): [number, string][] => {
    if (prohibited) {
      const dontRefresh = getRefreshFrequencyOptions(adminList).find(
        option => option.value === 0,
      );
      return [[0, dontRefresh?.label ?? t("Don't refresh")]];
    }
    return getAllowedRefreshOptions(policy, adminList).map(
      ({ value, label }): [number, string] => [value, label],
    );
  }, [prohibited, policy, adminList]);

  const otherWarnings = Object.entries(warnings).filter(
    ([field]) =>
      ![FREQUENCY_FIELD, MINIMUM_FIELD, MAXIMUM_FIELD].includes(field),
  );
  const policyWarningId = 'dashboard-refresh-policy-warning';
  const policyWarning = otherWarnings.length > 0 && (
    <Alert
      id={policyWarningId}
      type="warning"
      message={t(
        'These saved refresh settings are invalid. You can still Save. Fix them in Advanced settings.',
      )}
      description={
        <Flex vertical>
          {otherWarnings.map(([field, message]) => (
            <Typography.Text key={field}>
              {field === POLICY_KEY
                ? message
                : `${field.split('.').pop()}: ${message}`}
            </Typography.Text>
          ))}
        </Flex>
      }
      showIcon
      closable={false}
    />
  );

  const policySwitch = (
    <Flex key="refresh-policy-switch" vertical gap="small">
      <Flex align="center" gap="small">
        <Switch
          data-test="dashboard-refresh-policy-switch"
          aria-label={t('Use a refresh policy')}
          aria-describedby={describedBy(
            otherWarnings.length > 0 && policyWarningId,
          )}
          checked={policyOn}
          onChange={onPolicyOnChange}
        />
        <Typography.Text strong>{t('Use a refresh policy')}</Typography.Text>
      </Flex>
      <HelperText type="secondary">
        {t(
          'Without a policy, viewers can pick any interval, including Custom.',
        )}
      </HelperText>
    </Flex>
  );

  if (!policyOn) {
    return (
      <Flex vertical gap="middle">
        {policyEnabled && policySwitch}
        <div>
          <ModalFormField
            label={t('Refresh frequency')}
            helperText={t(
              'Set the automatic refresh frequency for this dashboard. The dashboard will reload its data at the specified interval.',
            )}
            bottomSpacing={false}
          >
            <div ref={frequencyRef}>
              <RefreshFrequencySelect
                aria-label={t('Refresh frequency')}
                aria-invalid={frequencyError ? true : undefined}
                aria-describedby={describedBy(
                  frequencyError && errorId(FREQUENCY_FIELD),
                )}
                value={refreshFrequency}
                onChange={onRefreshFrequencyChange}
              />
            </div>
          </ModalFormField>
          <ErrorRegion
            messages={[{ field: FREQUENCY_FIELD, message: frequencyError }]}
          />
        </div>
      </Flex>
    );
  }

  const boundField = (key: RefreshBoundKey) => {
    const field = key === MINIMUM_KEY ? MINIMUM_FIELD : MAXIMUM_FIELD;
    const otherKey = key === MINIMUM_KEY ? MAXIMUM_KEY : MINIMUM_KEY;
    const bound = policyObject?.[key];
    const seconds = getBoundSeconds(bound);
    const otherSeconds = getBoundSeconds(policyObject?.[otherKey]);
    const isSet = bound !== undefined && bound !== null;
    const isStale =
      seconds !== null &&
      !standardOptions.some(option => option.value === seconds);
    const error = errors[field];
    const note =
      isStale && !error
        ? t(
            "%s is no longer in the admin's list. Viewers get the intervals inside it.",
            formatBound(bound as RefreshBound),
          )
        : undefined;

    const fitsOther = (value: number) =>
      otherSeconds === null ||
      (key === MINIMUM_KEY ? value <= otherSeconds : value >= otherSeconds);
    const options = [
      { value: NO_LIMIT, label: t('No limit') },
      ...[
        ...standardOptions.filter(
          option => option.value !== seconds && fitsOther(option.value),
        ),
        ...(seconds !== null
          ? [
              {
                value: seconds,
                label:
                  standardOptions.find(option => option.value === seconds)
                    ?.label ?? formatBound(bound as RefreshBound),
              },
            ]
          : []),
      ].sort((a, b) => a.value - b.value),
    ];
    let value: number | string | undefined;
    if (!policyObject || (isSet && seconds === null)) {
      value = undefined;
    } else {
      value = seconds ?? NO_LIMIT;
    }
    const label =
      key === MINIMUM_KEY ? t('Shortest interval') : t('Longest interval');

    return (
      <div>
        <ModalFormField
          label={label}
          testId={`dashboard-refresh-${key}`}
          bottomSpacing={false}
        >
          <Select
            ref={key === MINIMUM_KEY ? minimumRef : maximumRef}
            ariaLabel={label}
            options={options}
            value={value}
            sortComparator={() => 0}
            disabled={!policyObject || !allowed}
            onChange={(next: number | string) =>
              onBoundChange(key, next === NO_LIMIT ? null : Number(next))
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(
              error && errorId(field),
              note && noteId(field),
              warnings[field] && warningId(field),
            )}
          />
        </ModalFormField>
        {note && (
          <HelperText type="secondary" id={noteId(field)}>
            {note}
          </HelperText>
        )}
        <ErrorRegion messages={[{ field, message: error }]} />
        {warnings[field] && (
          <Alert
            id={warningId(field)}
            type="warning"
            message={warnings[field]}
            showIcon
            closable={false}
          />
        )}
      </div>
    );
  };

  const allowedError = errors[ALLOWED_FIELD];

  return (
    <Flex vertical gap="middle">
      {policyWarning}
      {policyEnabled && policySwitch}
      <div ref={allowedRef}>
        <Flex vertical gap="small">
          <Flex align="center" gap="small">
            <Switch
              data-test="dashboard-refresh-allowed-switch"
              aria-label={t('Allow auto-refresh')}
              checked={policyObject ? allowed : false}
              disabled={!policyObject}
              onChange={onAllowedChange}
              aria-invalid={allowedError ? true : undefined}
              aria-describedby={describedBy(
                allowedError && errorId(ALLOWED_FIELD),
                warnings[ALLOWED_FIELD] && policyWarningId,
              )}
            />
            <Typography.Text strong>{t('Allow auto-refresh')}</Typography.Text>
          </Flex>
          {policyObject && !allowed && (
            <HelperText type="secondary">
              {t(
                "Viewers can't turn on auto-refresh for this dashboard, including embedded users.",
              )}
            </HelperText>
          )}
          <ErrorRegion
            messages={[{ field: ALLOWED_FIELD, message: allowedError }]}
          />
        </Flex>
      </div>
      <Row gutter={24}>
        <Col span={12}>{boundField(MINIMUM_KEY)}</Col>
        <Col span={12}>{boundField(MAXIMUM_KEY)}</Col>
      </Row>
      {policyObject && !allowed && (
        <HelperText type="secondary">
          {t(
            'These settings are kept and checked again when you turn auto-refresh back on.',
          )}
        </HelperText>
      )}
      {policyObject && showFrequency && (
        <div>
          <ModalFormField
            label={t('Default refresh frequency')}
            helperText={
              allowed
                ? t(
                    'Only intervals between the shortest and longest are offered.',
                  )
                : undefined
            }
            bottomSpacing={false}
          >
            <div ref={frequencyRef}>
              <RefreshFrequencySelect
                aria-label={t('Default refresh frequency')}
                aria-invalid={frequencyError ? true : undefined}
                aria-describedby={describedBy(
                  frequencyError && errorId(FREQUENCY_FIELD),
                  warnings[FREQUENCY_FIELD] && warningId(FREQUENCY_FIELD),
                )}
                value={refreshFrequency}
                onChange={onRefreshFrequencyChange}
                options={defaultOptions}
                showCustom={false}
              />
            </div>
          </ModalFormField>
          <ErrorRegion
            messages={[{ field: FREQUENCY_FIELD, message: frequencyError }]}
          />
          {warnings[FREQUENCY_FIELD] && (
            <Alert
              id={warningId(FREQUENCY_FIELD)}
              type="warning"
              message={warnings[FREQUENCY_FIELD]}
              showIcon
              closable={false}
            />
          )}
        </div>
      )}
    </Flex>
  );
};

export default RefreshSection;
