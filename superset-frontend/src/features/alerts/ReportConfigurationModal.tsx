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
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, styled, useTheme } from '@apache-superset/core/theme';
import { SupersetClient } from '@superset-ui/core';
import { getClientErrorObject } from '@superset-ui/core/query/getClientErrorObject';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  InfoTooltip,
  Flex,
  Input,
  InputNumber,
  Pagination,
  Switch,
} from '@superset-ui/core/components';
import { StandardModal, ModalFormField } from 'src/components/Modal';
import { useReportConfiguration } from './hooks/useReportConfiguration';
import type { ImpactedSchedule, ReportConfiguration } from './types';

const SECONDS_PER_MINUTE = 60;
const EMAIL_DOMAIN_REGEX =
  /^(?!\*\..*\.\*$)(?:\*\.)?(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:[a-zA-Z]{2,63}|\*)$/;

export interface ReportConfigurationModalProps {
  show: boolean;
  onHide: () => void;
  onSaved?: (configuration: ReportConfiguration) => void;
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
}

interface ConfigurationFormState {
  alerts_attach_reports: boolean;
  date_format_in_email_subject: boolean;
  alert_minimum_interval_minutes: number | null;
  report_minimum_interval_minutes: number | null;
  limit_recipients_to_users: boolean;
  allowed_email_domains: string;
}

const StyledImpactedList = styled.ul`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit}px 0 0;
    padding-left: ${theme.sizeUnit * 4}px;
    max-height: 200px;
    overflow-y: auto;
  `}
`;

const StyledInstruction = styled.span`
  ${({ theme }) => css`
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const StyledDomainField = styled.div`
  ${({ theme }) => css`
    .control-label [data-test='info-tooltip-icon'] {
      margin-left: ${theme.sizeUnit}px;
    }
  `}
`;

const secondsToMinutes = (seconds: number | null | undefined) =>
  seconds == null ? null : seconds / SECONDS_PER_MINUTE;

const toFormState = (
  configuration: ReportConfiguration | null,
): ConfigurationFormState => ({
  alerts_attach_reports: configuration
    ? Boolean(configuration.alerts_attach_reports)
    : true,
  date_format_in_email_subject:
    configuration?.date_format_in_email_subject ?? false,
  alert_minimum_interval_minutes: secondsToMinutes(
    configuration?.alert_minimum_interval,
  ),
  report_minimum_interval_minutes: secondsToMinutes(
    configuration?.report_minimum_interval,
  ),
  limit_recipients_to_users: configuration?.limit_recipients_to_users ?? false,
  allowed_email_domains: (configuration?.allowed_email_domains ?? []).join(
    ', ',
  ),
});

export const normalizeDomain = (domain: string) =>
  domain.trim().toLowerCase().replace(/^@/, '');

const parseDomains = (value: string) =>
  Array.from(new Set(value.split(',').map(normalizeDomain).filter(Boolean)));

const describeImpact = (schedule: ImpactedSchedule) =>
  schedule.reason === 'recipient'
    ? t('recipient %s is not allowed', schedule.detail)
    : t(
        'schedule "%s" runs more often than the minimum interval',
        schedule.detail,
      );

const ReportConfigurationModal: FunctionComponent<
  ReportConfigurationModalProps
> = ({ show, onHide, onSaved, addSuccessToast, addDangerToast }) => {
  const theme = useTheme();
  const { configuration, loading, error, refresh } =
    useReportConfiguration(show);
  const [form, setForm] = useState<ConfigurationFormState>(toFormState(null));
  const [saving, setSaving] = useState(false);
  const [impacted, setImpacted] = useState<ImpactedSchedule[]>([]);
  const [conflictPage, setConflictPage] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (configuration) {
      setForm(toFormState(configuration));
    }
  }, [configuration]);

  useEffect(() => {
    if (show) {
      setImpacted([]);
      setSaveError(null);
    }
  }, [show]);

  const domains = useMemo(
    () => parseDomains(form.allowed_email_domains),
    [form.allowed_email_domains],
  );
  const invalidDomains = domains.filter(
    domain => !EMAIL_DOMAIN_REGEX.test(domain),
  );

  const updateForm = <K extends keyof ConfigurationFormState>(
    key: K,
    value: ConfigurationFormState[K],
  ) => {
    setForm(current => ({ ...current, [key]: value }));
    setImpacted([]);
    setSaveError(null);
  };

  const onSave = async () => {
    setSaving(true);
    setImpacted([]);
    setSaveError(null);
    const payload: ReportConfiguration = {
      alerts_attach_reports: form.alerts_attach_reports,
      date_format_in_email_subject: form.date_format_in_email_subject,
      alert_minimum_interval:
        form.alert_minimum_interval_minutes === null
          ? null
          : Math.round(
              form.alert_minimum_interval_minutes * SECONDS_PER_MINUTE,
            ),
      report_minimum_interval:
        form.report_minimum_interval_minutes === null
          ? null
          : Math.round(
              form.report_minimum_interval_minutes * SECONDS_PER_MINUTE,
            ),
      limit_recipients_to_users: form.limit_recipients_to_users,
      allowed_email_domains: domains,
    };
    const initial = toFormState(configuration);
    const changed: Partial<ReportConfiguration> = {};
    if (form.alerts_attach_reports !== initial.alerts_attach_reports) {
      changed.alerts_attach_reports = payload.alerts_attach_reports;
    }
    if (
      form.date_format_in_email_subject !== initial.date_format_in_email_subject
    ) {
      changed.date_format_in_email_subject =
        payload.date_format_in_email_subject;
    }
    if (
      form.alert_minimum_interval_minutes !==
      initial.alert_minimum_interval_minutes
    ) {
      changed.alert_minimum_interval = payload.alert_minimum_interval;
    }
    if (
      form.report_minimum_interval_minutes !==
      initial.report_minimum_interval_minutes
    ) {
      changed.report_minimum_interval = payload.report_minimum_interval;
    }
    if (form.limit_recipients_to_users !== initial.limit_recipients_to_users) {
      changed.limit_recipients_to_users = payload.limit_recipients_to_users;
    }
    if (
      JSON.stringify(domains) !==
      JSON.stringify(parseDomains(initial.allowed_email_domains))
    ) {
      changed.allowed_email_domains = payload.allowed_email_domains;
    }
    try {
      const response = await SupersetClient.put({
        endpoint: '/api/v1/report/configuration/',
        jsonPayload: changed,
      });
      const saved = (response.json?.result ?? payload) as ReportConfiguration;
      addSuccessToast(t('Alerts & Reports configuration updated'));
      onSaved?.(saved);
      onHide();
    } catch (err) {
      const clientError = await getClientErrorObject(err);
      const impactedSchedules = (
        clientError as { impacted_schedules?: ImpactedSchedule[] }
      ).impacted_schedules;
      if (impactedSchedules?.length) {
        setImpacted(impactedSchedules);
        setConflictPage(1);
        setSaveError(
          clientError.message ||
            t(
              'Some existing alerts/reports conflict with the new configuration. Please update them first.',
            ),
        );
      } else {
        const message =
          clientError.message ||
          clientError.error ||
          t('An error occurred while saving the configuration');
        setSaveError(message);
        addDangerToast(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardModal
      show={show}
      width={440}
      onHide={onHide}
      onSave={onSave}
      saveText={t('Save')}
      saveDisabled={loading || error || invalidDomains.length > 0}
      saveLoading={saving}
      contentLoading={loading && !configuration}
      title={t('Alerts & Reports configuration')}
      isEditMode
      wrapProps={{ 'data-test': 'report-configuration-modal' }}
    >
      <Flex vertical gap={theme.marginLG} style={{ padding: theme.paddingLG }}>
        {error && (
          <Alert
            type="error"
            showIcon
            closable={false}
            message={t('Unable to load the Alerts & Reports configuration.')}
            description={
              <Button buttonStyle="link" onClick={() => refresh()}>
                {t('Retry')}
              </Button>
            }
          />
        )}
        <Flex vertical gap={theme.margin}>
          <Flex align="center" gap={theme.marginXS}>
            <Switch
              checked={form.alerts_attach_reports}
              disabled={saving}
              onChange={(checked: boolean) =>
                updateForm('alerts_attach_reports', checked)
              }
              aria-label={t('Enable attachments for alerts')}
            />
            <Flex align="center" gap={theme.sizeUnit}>
              <span>{t('Enable attachments for alerts')}</span>
              <InfoTooltip
                tooltip={t(
                  'When disabled, alerts only send the message and link, without screenshots or data files. Applies to all alerts.',
                )}
              />
            </Flex>
          </Flex>
          <Flex align="center" gap={theme.marginXS}>
            <Switch
              checked={form.limit_recipients_to_users}
              disabled={saving}
              onChange={(checked: boolean) =>
                updateForm('limit_recipients_to_users', checked)
              }
              aria-label={t('Limit recipients to users')}
            />
            <Flex align="center" gap={theme.sizeUnit}>
              <span>{t('Limit recipients to users')}</span>
              <InfoTooltip
                tooltip={t(
                  'Only e-mail addresses of existing active users can be used as recipients.',
                )}
              />
            </Flex>
          </Flex>
          <Flex align="center" gap={theme.marginXS}>
            <Switch
              checked={form.date_format_in_email_subject}
              disabled={saving}
              onChange={(checked: boolean) =>
                updateForm('date_format_in_email_subject', checked)
              }
              aria-label={t('Format dates in email subjects')}
            />
            <Flex align="center" gap={theme.sizeUnit}>
              <span>{t('Format dates in email subjects')}</span>
              <InfoTooltip
                tooltip={t(
                  'Replace strftime date placeholders such as %Y-%m-%d in alert and report email subjects with the UTC date when sent.',
                )}
              />
            </Flex>
          </Flex>
        </Flex>
        <Flex vertical gap={theme.marginSM}>
          <Flex align="center" gap={theme.marginSM} wrap>
            <label htmlFor="alert_minimum_interval_minutes">
              {t('Alert minimum interval')}
            </label>
            <Flex align="center" gap={theme.marginXS}>
              <InputNumber
                id="alert_minimum_interval_minutes"
                disabled={saving}
                aria-label={t('Alert minimum interval')}
                min={0}
                step={1}
                precision={0}
                controls
                style={{ width: theme.controlHeight * 2 }}
                value={
                  form.alert_minimum_interval_minutes == null
                    ? undefined
                    : Math.ceil(form.alert_minimum_interval_minutes)
                }
                onChange={(value: number | string | null) =>
                  updateForm(
                    'alert_minimum_interval_minutes',
                    value === null || value === ''
                      ? null
                      : Math.max(0, Math.round(Number(value))),
                  )
                }
              />
              <span>{t('minutes')}</span>
            </Flex>
          </Flex>
          {form.alert_minimum_interval_minutes != null &&
            !Number.isInteger(form.alert_minimum_interval_minutes) && (
              <span>
                {t(
                  'Existing minimum: %s seconds. Editing replaces it with whole minutes.',
                  form.alert_minimum_interval_minutes * SECONDS_PER_MINUTE,
                )}
              </span>
            )}
          <Flex align="center" gap={theme.marginSM} wrap>
            <label htmlFor="report_minimum_interval_minutes">
              {t('Report minimum interval')}
            </label>
            <Flex align="center" gap={theme.marginXS}>
              <InputNumber
                id="report_minimum_interval_minutes"
                disabled={saving}
                aria-label={t('Report minimum interval')}
                min={0}
                step={1}
                precision={0}
                controls
                style={{ width: theme.controlHeight * 2 }}
                value={
                  form.report_minimum_interval_minutes == null
                    ? undefined
                    : Math.ceil(form.report_minimum_interval_minutes)
                }
                onChange={(value: number | string | null) =>
                  updateForm(
                    'report_minimum_interval_minutes',
                    value === null || value === ''
                      ? null
                      : Math.max(0, Math.round(Number(value))),
                  )
                }
              />
              <span>{t('minutes')}</span>
            </Flex>
          </Flex>
          {form.report_minimum_interval_minutes != null &&
            !Number.isInteger(form.report_minimum_interval_minutes) && (
              <span>
                {t(
                  'Existing minimum: %s seconds. Editing replaces it with whole minutes.',
                  form.report_minimum_interval_minutes * SECONDS_PER_MINUTE,
                )}
              </span>
            )}
          <StyledInstruction>
            {t('Use 0 or leave empty to allow any schedule.')}
          </StyledInstruction>
        </Flex>
        <StyledDomainField>
          <ModalFormField
            label={t('Allowed e-mail domains')}
            helperText={t(
              'Separate domains with commas. Leave empty to allow any domain.',
            )}
            tooltip={t(
              'Use example.com for an exact domain, *.example.com for subdomains, or preset.* for preset.io and preset.ai. A trailing wildcard matches one segment. Leave empty to allow any domain.',
            )}
            error={
              invalidDomains.length
                ? t('Invalid domain(s): %s', invalidDomains.join(', '))
                : undefined
            }
            bottomSpacing={false}
          >
            <Input.TextArea
              rows={3}
              disabled={saving}
              aria-label={t('Allowed e-mail domains')}
              placeholder={t('example.com, *.example.org')}
              value={form.allowed_email_domains}
              onChange={event =>
                updateForm('allowed_email_domains', event.target.value)
              }
            />
          </ModalFormField>
        </StyledDomainField>
        {saveError && (
          <Alert
            type={impacted.length ? 'warning' : 'error'}
            showIcon
            closable={false}
            message={saveError}
            description={
              impacted.length ? (
                <>
                  <StyledImpactedList data-test="impacted-schedules">
                    {impacted
                      .slice((conflictPage - 1) * 10, conflictPage * 10)
                      .map(schedule => (
                        <li
                          key={`${schedule.id}-${schedule.reason}-${schedule.detail}`}
                        >
                          <strong>{schedule.name}</strong> ({schedule.type}):{' '}
                          {describeImpact(schedule)}
                        </li>
                      ))}
                  </StyledImpactedList>
                  <Pagination
                    current={conflictPage}
                    pageSize={10}
                    total={impacted.length}
                    onChange={setConflictPage}
                    showSizeChanger={false}
                    hideOnSinglePage
                  />
                </>
              ) : undefined
            }
          />
        )}
      </Flex>
    </StandardModal>
  );
};

export default ReportConfigurationModal;
