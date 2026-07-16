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
import {
  FunctionComponent,
  useState,
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import rison from 'rison';

import { t } from '@apache-superset/core/translation';
import {
  FeatureFlag,
  JsonResponse,
  SupersetClient,
  isFeatureEnabled,
  handleKeyboardActivation,
} from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { AsyncSelect, Input, Select } from '@superset-ui/core/components';
import RefreshLabel from '@superset-ui/core/components/RefreshLabel';
import {
  NotificationMethodOption,
  NotificationSetting,
  SlackChannel,
} from '../types';
import { StyledInputContainer } from '../AlertReportModal';

const StyledNotificationMethod = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 3}px;

    .input-container {
      textarea {
        height: auto;
      }

      &.error {
        input {
          border-color: ${theme.colorError};
        }
      }

      .helper {
        margin-top: ${theme.sizeUnit * 2}px;
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorTextSecondary};
      }
    }

    .inline-container {
      margin-bottom: ${theme.sizeUnit * 2}px;

      > div {
        margin: 0px;
      }

      .delete-button {
        margin-left: ${theme.sizeUnit * 2}px;
        padding-top: ${theme.sizeUnit}px;
      }
      .anticon {
        margin-left: ${theme.sizeUnit}px;
      }
    }

    .ghost-button {
      color: ${theme.colorPrimaryText};
      display: inline-flex;
      align-items: center;
      font-size: ${theme.fontSizeSM}px;
      cursor: pointer;

      .icon {
        width: ${theme.sizeUnit * 3}px;
        height: ${theme.sizeUnit * 3}px;
        font-size: ${theme.fontSizeSM}px;
        margin-right: ${theme.sizeUnit}px;
      }
    }

    .ghost-button + .ghost-button {
      margin-left: ${theme.sizeUnit * 4}px;
    }

    .ghost-button:first-of-type[style*='none'] + .ghost-button {
      margin-left: 0px; /* Remove margin when the first button is hidden */
    }

    .email-recipient-container {
      display: flex;
      flex-direction: column;
      align-items: stretch;

      .email-recipient-select,
      .email-recipient-select > div {
        width: 100%;
      }

      .helper {
        margin-top: ${theme.sizeUnit * 2}px;
        padding: 0;
      }
    }
  `}
`;

const TRANSLATIONS = {
  EMAIL_CC_NAME: t('CC recipients'),
  EMAIL_BCC_NAME: t('BCC recipients'),
  EMAIL_SUBJECT_NAME: t('Email subject name (optional)'),
  EMAIL_SUBJECT_ERROR_TEXT: t(
    'Please enter valid text. Spaces alone are not permitted.',
  ),
};

interface NotificationMethodProps {
  setting?: NotificationSetting | null;
  index: number;
  onUpdate?: (index: number, updatedSetting: NotificationSetting) => void;
  onRemove?: (index: number) => void;
  onInputChange?: (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => void;
  email_subject: string;
  defaultSubject: string;
  setErrorSubject: (hasError: boolean) => void;
}

export const mapSlackValues = ({
  method,
  recipientValue,
  slackOptions,
}: {
  method: string;
  recipientValue: string;
  slackOptions: { label: string; value: string }[];
}) => {
  const prop = method === NotificationMethodOption.SlackV2 ? 'value' : 'label';
  return recipientValue
    .split(',')
    .map(recipient =>
      slackOptions.find(
        option =>
          option[prop].trim().toLowerCase() === recipient.trim().toLowerCase(),
      ),
    )
    .filter(val => !!val) as { label: string; value: string }[];
};

type EmailRecipientField = 'recipients' | 'cc' | 'bcc';

type EmailRecipientOption = {
  label: string;
  value: string;
};

type RelatedUserOption = {
  text: string;
  value: number;
  extra?: {
    email?: string;
  };
};

const emailRecipientSeparators = /[,;]/;

const recipientStringToOptions = (value: string): EmailRecipientOption[] =>
  value
    .split(emailRecipientSeparators)
    .map(recipient => recipient.trim())
    .filter(Boolean)
    .map(recipient => ({
      label: recipient,
      value: recipient,
    }));

const isEmailRecipientOption = (
  option: unknown,
): option is EmailRecipientOption => {
  if (!option || typeof option !== 'object') {
    return false;
  }
  const { value } = option as { value?: unknown };
  return typeof value === 'string';
};

const normalizeEmailRecipientOptions = (
  selected: unknown,
): EmailRecipientOption[] =>
  Array.isArray(selected) ? selected.filter(isEmailRecipientOption) : [];

const emailRecipientOptionsToString = (selected: unknown) =>
  normalizeEmailRecipientOptions(selected)
    .map(option => option.value)
    .join(',');

const fetchEmailRecipientOptions = async (
  filterValue: string,
  page: number,
  pageSize: number,
) => {
  const query = rison.encode_uri({
    filter: filterValue,
    page,
    page_size: pageSize,
    order_column: 'username',
    order_direction: 'asc',
  });

  const response = await SupersetClient.get({
    endpoint: `/api/v1/report/related/created_by?q=${query}`,
  });
  const results = (response.json?.result ?? []) as RelatedUserOption[];

  return {
    data: results
      .filter(
        (user): user is RelatedUserOption & { extra: { email: string } } =>
          !!user.extra?.email,
      )
      .map(({ text, extra }) => ({
        value: extra.email,
        label: `${text} <${extra.email}>`,
      })),
    totalCount: response.json?.count ?? 0,
  };
};

export const NotificationMethod: FunctionComponent<NotificationMethodProps> = ({
  setting = null,
  index,
  onUpdate,
  onRemove,
  onInputChange,
  email_subject,
  defaultSubject,
  setErrorSubject,
}) => {
  const { method, recipients, cc, bcc, options } = setting || {};
  const [recipientValue, setRecipientValue] = useState<string>(
    recipients || '',
  );
  const [slackRecipients, setSlackRecipients] = useState<
    { label: string; value: string }[]
  >([]);
  const [error, setError] = useState(false);
  const [ccVisible, setCcVisible] = useState<boolean>(!!cc);
  const [bccVisible, setBccVisible] = useState<boolean>(!!bcc);
  const [ccValue, setCcValue] = useState<string>(cc || '');
  const [bccValue, setBccValue] = useState<string>(bcc || '');
  const theme = useTheme();
  const [methodOptionsLoading, setMethodOptionsLoading] =
    useState<boolean>(true);
  const [slackRefreshKey, setSlackRefreshKey] = useState<number>(0);
  const forceRefreshSlackRef = useRef<boolean>(false);
  const recipientEmailOptions = useMemo(
    () => recipientStringToOptions(recipientValue),
    [recipientValue],
  );
  const ccEmailOptions = useMemo(
    () => recipientStringToOptions(ccValue),
    [ccValue],
  );
  const bccEmailOptions = useMemo(
    () => recipientStringToOptions(bccValue),
    [bccValue],
  );

  const [useSlackV1, setUseSlackV1] = useState<boolean>(false);

  const onMethodChange = (selected: {
    label: string;
    value: NotificationMethodOption;
  }) => {
    // Since we're swapping the method, reset the recipients
    setRecipientValue('');
    setCcValue('');
    setBccValue('');

    if (onUpdate && setting) {
      const updatedSetting = {
        ...setting,
        method: selected.value,
        recipients: '',
        cc: '',
        bcc: '',
      };

      onUpdate(index, updatedSetting);
    }
  };

  const fetchSlackChannels = ({
    searchString = '',
    types = [],
    exactMatch = false,
    force = false,
    page,
    pageSize,
  }: {
    searchString?: string;
    types?: string[];
    exactMatch?: boolean;
    force?: boolean;
    page?: number;
    pageSize?: number;
  } = {}): Promise<JsonResponse> => {
    const queryString = rison.encode({
      search_string: searchString,
      types,
      exact_match: exactMatch,
      force,
      ...(page !== undefined ? { page } : {}),
      ...(pageSize !== undefined ? { page_size: pageSize } : {}),
    });
    const endpoint = `/api/v1/report/slack_channels/?q=${queryString}`;
    return SupersetClient.get({ endpoint });
  };

  // Lazily fetch one page of channels as the user searches, so workspaces with
  // tens of thousands of channels never load the whole list into the browser.
  const loadSlackChannels = useCallback(
    async (search: string, page: number, pageSize: number) => {
      const force = forceRefreshSlackRef.current;
      forceRefreshSlackRef.current = false;
      const { json } = await fetchSlackChannels({
        searchString: search,
        types: ['public_channel', 'private_channel'],
        force,
        page,
        pageSize,
      });
      const result = (json?.result ?? []) as SlackChannel[];
      return {
        data: result.map(channel => ({
          label:
            !channel.is_private && !channel.is_member
              ? `${channel.name} ${t('(Bot not in channel)')}`
              : channel.name,
          value: channel.id,
        })),
        totalCount: json?.count ?? result.length,
      };
    },
    // fetchSlackChannels only closes over stable refs/imports
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const onRefreshSlackChannels = () => {
    forceRefreshSlackRef.current = true;
    // Remount the AsyncSelect so its internal result cache is discarded and the
    // forced (cache-busting) fetch runs.
    setSlackRefreshKey(key => key + 1);
  };

  // Resolve the channel ids saved on an existing SlackV2 report into
  // human-readable labels. Bounded by exact_match so it never enumerates the
  // whole workspace.
  useEffect(() => {
    let cancelled = false;
    const slackEnabled = options?.some(
      option =>
        option === NotificationMethodOption.Slack ||
        option === NotificationMethodOption.SlackV2,
    );
    const savedIds =
      method === NotificationMethodOption.SlackV2 && recipientValue
        ? recipientValue
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
        : [];

    const resolveSavedRecipients = async () => {
      // Show the saved ids immediately so the existing selection is always
      // visible, then enrich with channel names once the lookup resolves.
      if (savedIds.length && !cancelled) {
        setSlackRecipients(savedIds.map(id => ({ label: id, value: id })));
      }
      try {
        if (savedIds.length) {
          const { json } = await fetchSlackChannels({
            searchString: recipientValue,
            types: ['public_channel', 'private_channel'],
            exactMatch: true,
          });
          const result = (json?.result ?? []) as SlackChannel[];
          const namesById = new Map(
            result.map(channel => [channel.id, channel.name]),
          );
          if (!cancelled) {
            setSlackRecipients(
              savedIds.map(id => ({
                label: namesById.get(id) ?? id,
                value: id,
              })),
            );
          }
        }
      } catch {
        // Keep the raw ids as labels; the AsyncSelect onError handler drives
        // the v1 fallback for the picker itself.
      } finally {
        if (!cancelled) {
          setMethodOptionsLoading(false);
        }
      }
    };

    if (slackEnabled) {
      resolveSavedRecipients();
    } else {
      setMethodOptionsLoading(false);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (recipients !== undefined && recipientValue !== recipients) {
      setRecipientValue(recipients);
    }
  }, [recipientValue, recipients]);

  useEffect(() => {
    if (cc !== undefined && ccValue !== cc) {
      setCcValue(cc);
    }
  }, [cc, ccValue]);

  useEffect(() => {
    if (bcc !== undefined && bccValue !== bcc) {
      setBccValue(bcc);
    }
  }, [bcc, bccValue]);

  const methodOptions = useMemo(
    () =>
      (options || [])
        .filter(
          method =>
            (isFeatureEnabled(FeatureFlag.AlertReportSlackV2) &&
              !useSlackV1 &&
              method === NotificationMethodOption.SlackV2) ||
            ((!isFeatureEnabled(FeatureFlag.AlertReportSlackV2) ||
              useSlackV1) &&
              method === NotificationMethodOption.Slack) ||
            (isFeatureEnabled(FeatureFlag.AlertReportWebhook) &&
              method === NotificationMethodOption.Webhook) ||
            method === NotificationMethodOption.Email,
        )
        .map(method => ({
          label:
            method === NotificationMethodOption.SlackV2
              ? NotificationMethodOption.Slack
              : method,
          value: method,
        })),
    [options, useSlackV1],
  );

  if (!setting) {
    return null;
  }

  const onRecipientsChange = (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const { target } = event;

    setRecipientValue(target.value);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        recipients: target.value,
      };

      onUpdate(index, updatedSetting);
    }
  };

  const onEmailRecipientsChange =
    (field: EmailRecipientField) => (selected: unknown) => {
      const value = emailRecipientOptionsToString(selected);

      if (field === 'recipients') {
        setRecipientValue(value);
      } else if (field === 'cc') {
        setCcValue(value);
      } else {
        setBccValue(value);
      }

      if (onUpdate) {
        const updatedSetting = {
          ...setting,
          [field]: value,
        };

        onUpdate(index, updatedSetting);
      }
    };

  const onSlackRecipientsChange = (
    recipients: { label: string; value: string }[],
  ) => {
    setSlackRecipients(recipients);

    if (onUpdate) {
      const updatedSetting = {
        ...setting,
        recipients: recipients?.map(obj => obj.value).join(','),
      };

      onUpdate(index, updatedSetting);
    }
  };

  const onSubjectChange = (
    event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => {
    const { value } = event.target;

    if (onInputChange) {
      onInputChange(event);
    }

    const hasError = value.length > 0 && value.trim().length === 0;
    setError(hasError);
    if (setErrorSubject) {
      setErrorSubject(hasError);
    }
  };

  return (
    <StyledNotificationMethod>
      <div className="inline-container">
        <StyledInputContainer>
          <div className="control-label">{t('Notification Method')}</div>
          <div className="input-container">
            <Select
              ariaLabel={t('Delivery method')}
              data-test="select-delivery-method"
              labelInValue
              onChange={onMethodChange}
              placeholder={t('Select Delivery Method')}
              options={methodOptions}
              showSearch
              value={methodOptions.find(option => option.value === method)}
              loading={methodOptionsLoading}
            />
            {index !== 0 && !!onRemove ? (
              <span
                role="button"
                tabIndex={0}
                className="delete-button"
                onClick={() => onRemove(index)}
                onKeyDown={handleKeyboardActivation(() => onRemove(index))}
                aria-label={t('Remove notification method')}
              >
                <Icons.DeleteOutlined iconSize="l" />
              </span>
            ) : null}
          </div>
        </StyledInputContainer>
      </div>
      {method !== undefined ? (
        <>
          {method === NotificationMethodOption.Email ? (
            <div className="inline-container">
              <StyledInputContainer>
                <>
                  <div className="control-label">
                    {TRANSLATIONS.EMAIL_SUBJECT_NAME}
                  </div>
                  <div className={`input-container ${error ? 'error' : ''}`}>
                    <Input
                      type="text"
                      name="email_subject"
                      value={email_subject}
                      placeholder={defaultSubject}
                      onChange={onSubjectChange}
                    />
                  </div>
                  {error && (
                    <div
                      style={{
                        color: theme.colorError,
                        fontSize: theme.sizeUnit * 3,
                      }}
                    >
                      {TRANSLATIONS.EMAIL_SUBJECT_ERROR_TEXT}
                    </div>
                  )}
                </>
              </StyledInputContainer>
            </div>
          ) : null}
          {method !== NotificationMethodOption.Webhook ? (
            <div className="inline-container">
              <StyledInputContainer>
                <div className="control-label">
                  {t(
                    '%s recipients',
                    method === NotificationMethodOption.SlackV2
                      ? NotificationMethodOption.Slack
                      : method,
                  )}
                  <span className="required">*</span>
                </div>
                <div>
                  {method === NotificationMethodOption.Slack ? (
                    <>
                      <div className="input-container">
                        <Input.TextArea
                          name="To"
                          data-test="recipients"
                          value={recipientValue}
                          onChange={onRecipientsChange}
                        />
                      </div>
                      <div className="input-container">
                        <div className="helper">
                          {t('Recipients are separated by "," or ";"')}
                        </div>
                      </div>
                    </>
                  ) : method === NotificationMethodOption.Email ? (
                    <div className="input-container email-recipient-container">
                      <AsyncSelect
                        name="To"
                        ariaLabel={t('Email recipients')}
                        className="email-recipient-select"
                        data-test="recipients"
                        mode="multiple"
                        value={recipientEmailOptions}
                        options={fetchEmailRecipientOptions}
                        onChange={onEmailRecipientsChange('recipients')}
                        placeholder={t('Select or type email recipients')}
                        allowNewOptions
                        lazyLoading={false}
                      />
                      <div className="helper">
                        {t('Recipients are separated by "," or ";"')}
                      </div>
                    </div>
                  ) : (
                    // for SlackV2
                    <div className="input-container">
                      <AsyncSelect
                        key={slackRefreshKey}
                        ariaLabel={t('Select channels')}
                        mode="multiple"
                        name="recipients"
                        value={slackRecipients}
                        options={loadSlackChannels}
                        onChange={onSlackRecipientsChange}
                        onError={() => setUseSlackV1(true)}
                        allowClear
                        allowNewOptions
                        data-test="recipients"
                        labelInValue
                        placeholder={t(
                          'Search a channel by name, or paste a channel ID',
                        )}
                      />
                      <RefreshLabel
                        onClick={onRefreshSlackChannels}
                        tooltipContent={t('Force refresh Slack channels list')}
                      />
                    </div>
                  )}
                </div>
              </StyledInputContainer>
            </div>
          ) : (
            <div className="inline-container">
              <StyledInputContainer>
                <div className="control-label">
                  {t('%s URL', method)}
                  <span className="required">*</span>
                </div>
                <div>
                  <div className="input-container">
                    <Input
                      name="To"
                      data-test="recipients"
                      value={recipientValue}
                      onChange={onRecipientsChange}
                    />
                  </div>
                </div>
              </StyledInputContainer>
            </div>
          )}
          {method === NotificationMethodOption.Email && (
            <StyledInputContainer>
              {/* Render "CC" input field if ccVisible is true */}
              {ccVisible && (
                <>
                  <div className="control-label">
                    {TRANSLATIONS.EMAIL_CC_NAME}
                  </div>
                  <div className="input-container email-recipient-container">
                    <AsyncSelect
                      name="CC"
                      ariaLabel={TRANSLATIONS.EMAIL_CC_NAME}
                      className="email-recipient-select"
                      data-test="cc"
                      mode="multiple"
                      value={ccEmailOptions}
                      options={fetchEmailRecipientOptions}
                      onChange={onEmailRecipientsChange('cc')}
                      placeholder={t('Select or type CC recipients')}
                      allowNewOptions
                      lazyLoading={false}
                    />
                  </div>
                  <div className="input-container">
                    <div className="helper">
                      {t('Recipients are separated by "," or ";"')}
                    </div>
                  </div>
                </>
              )}
              {/* Render "BCC" input field if bccVisible is true */}
              {bccVisible && (
                <>
                  <div className="control-label">
                    {TRANSLATIONS.EMAIL_BCC_NAME}
                  </div>
                  <div className="input-container email-recipient-container">
                    <AsyncSelect
                      name="BCC"
                      ariaLabel={TRANSLATIONS.EMAIL_BCC_NAME}
                      className="email-recipient-select"
                      data-test="bcc"
                      mode="multiple"
                      value={bccEmailOptions}
                      options={fetchEmailRecipientOptions}
                      onChange={onEmailRecipientsChange('bcc')}
                      placeholder={t('Select or type BCC recipients')}
                      allowNewOptions
                      lazyLoading={false}
                    />
                  </div>
                  <div className="input-container">
                    <div className="helper">
                      {t('Recipients are separated by "," or ";"')}
                    </div>
                  </div>
                </>
              )}
              {/* New buttons container */}
              <div className="ghost-button">
                <span
                  className="ghost-button"
                  role="button"
                  tabIndex={0}
                  onClick={() => setCcVisible(true)}
                  onKeyDown={handleKeyboardActivation(() => setCcVisible(true))}
                  style={{ display: ccVisible ? 'none' : 'inline-flex' }}
                >
                  <Icons.MailOutlined iconSize="xs" className="icon" />
                  {t('Add CC Recipients')}
                </span>
                <span
                  className="ghost-button"
                  role="button"
                  tabIndex={0}
                  onClick={() => setBccVisible(true)}
                  onKeyDown={handleKeyboardActivation(() =>
                    setBccVisible(true),
                  )}
                  style={{ display: bccVisible ? 'none' : 'inline-flex' }}
                >
                  <Icons.MailOutlined iconSize="xs" className="icon" />
                  {t('Add BCC Recipients')}
                </span>
              </div>
            </StyledInputContainer>
          )}
        </>
      ) : null}
    </StyledNotificationMethod>
  );
};
