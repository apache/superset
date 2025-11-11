/* eslint-disable camelcase */
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
  useEffect,
  useState,
  ChangeEvent,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { debounce } from 'lodash';
import rison from 'rison';

import { t } from '@apache-superset/core/translation';
import {
  FeatureFlag,
  SupersetClient,
  isFeatureEnabled,
  logging,
} from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { AsyncSelect, Input, Select } from '@superset-ui/core/components';
import {
  NotificationMethodOption,
  NotificationSetting,
  SlackChannel,
} from '../types';
import { StyledInputContainer } from '../AlertReportModal';
import { styled, useTheme } from '@apache-superset/core/ui';
import { useSlackChannels } from '../hooks/useSlackChannels';

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

      .refresh-button {
        margin-left: ${theme.sizeUnit * 2}px;
        cursor: pointer;
        color: ${theme.colorTextSecondary};

        &:hover {
          color: ${theme.colorPrimary};
        }
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
  emailSubject: string;
  defaultSubject: string;
  setErrorSubject: (hasError: boolean) => void;
  addDangerToast?: (msg: string) => void;
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
  emailSubject,
  defaultSubject,
  setErrorSubject,
  addDangerToast,
}) => {
  const theme = useTheme();

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
  const hasShownErrorToast = useRef(false);
  const [searchGeneration, setSearchGeneration] = useState(0);
  const lastSearchValueRef = useRef('');

  const {
    fetchChannels: fetchSlackChannelsFromHook,
    refreshChannels,
    isRefreshing,
  } = useSlackChannels(addDangerToast);

  const onMethodChange = (selected: {
    label: string;
    value: NotificationMethodOption;
  }) => {
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

  const fetchSlackChannels = useCallback(
    async (
      search: string,
      page: number,
      pageSize: number,
    ): Promise<{
      data: { label: string; value: string }[];
      totalCount: number;
    }> => {
      try {
        const result = await fetchSlackChannelsFromHook(search, page, pageSize);

        hasShownErrorToast.current = false;

        return result;
      } catch (error) {
        logging.error('Failed to fetch Slack channels:', error);

        // Show user-friendly error message
        if (addDangerToast && !hasShownErrorToast.current) {
          addDangerToast(
            t(
              'Unable to load Slack channels. Please check your Slack API token configuration. ' +
                'Switching to manual channel input.',
            ),
          );
          hasShownErrorToast.current = true;
        }

        // Fallback to Slack v1 without clearing recipients to prevent data loss
        setUseSlackV1(true);

        // Auto-switch to Slack V1 in the notification method dropdown
        if (
          onUpdate &&
          setting &&
          setting.method === NotificationMethodOption.SlackV2
        ) {
          onUpdate(index, {
            ...setting,
            method: NotificationMethodOption.Slack, // Switch from SlackV2 to Slack V1
          });
        }

        return {
          data: [],
          totalCount: 0,
        };
      }
    },
    // Note: searchGeneration is intentionally included even though not used in function body
    // Purpose: Trigger function reference change when search changes (after debounce)
    // Effect: Forces AsyncSelect to clear internal state and show fresh results
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      fetchSlackChannelsFromHook,
      addDangerToast,
      onUpdate,
      setting,
      index,
      searchGeneration,
    ],
  );

  const handleRefreshSlackChannels = refreshChannels;

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

  // Reset error toast flag when method changes
  useEffect(() => {
    hasShownErrorToast.current = false;
  }, [method]);

  // Initialize slackRecipients when editing an existing alert with SlackV2
  useEffect(() => {
    const initializeSlackRecipients = async () => {
      if (
        method === NotificationMethodOption.SlackV2 &&
        recipients &&
        slackRecipients.length === 0
      ) {
        try {
          const channelData = await fetchSlackChannels('', 0, 100);
          const recipientIds = recipients.split(',').map(id => id.trim());

          const mappedRecipients = recipientIds
            .map(id => {
              const channel = channelData.data.find(
                ch => ch.value.toLowerCase() === id.toLowerCase(),
              );
              return channel || { label: id, value: id };
            })
            .filter(r => r.value);

          setSlackRecipients(mappedRecipients);
        } catch (error) {
          const recipientIds = recipients.split(',').map(id => id.trim());
          const fallbackRecipients = recipientIds.map(id => ({
            label: id,
            value: id,
          }));
          setSlackRecipients(fallbackRecipients);
        }
      }
    };

    initializeSlackRecipients();
  }, [method, recipients]);

  const debouncedSearchUpdate = useMemo(
    () =>
      debounce((search: string) => {
        const trimmedSearch = search.trim();
        if (lastSearchValueRef.current !== trimmedSearch) {
          lastSearchValueRef.current = trimmedSearch;
          setSearchGeneration(prev => prev + 1);
        }
      }, 500),
    [],
  );

  useEffect(
    () => () => debouncedSearchUpdate.cancel(),
    [debouncedSearchUpdate],
  );

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

  const handleSlackSearch = (search: string) => {
    debouncedSearchUpdate(search);
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
            />
            {index !== 0 && !!onRemove ? (
              <span
                role="button"
                tabIndex={0}
                className="delete-button"
                onClick={() => onRemove(index)}
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
                      value={emailSubject}
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
                    <div className="input-container">
                      <AsyncSelect
                        key={refreshKey}
                        ariaLabel={t('Select channels')}
                        mode="multiple"
                        name="recipients"
                        value={slackRecipients}
                        options={fetchSlackChannels}
                        onChange={onSlackRecipientsChange}
                        allowClear
                        data-test="recipients"
                        fetchOnlyOnSearch={false}
                        pageSize={100}
                        placeholder={t('Select Slack channels')}
                      />
                      <span
                        role="button"
                        tabIndex={0}
                        className="refresh-button"
                        onClick={handleRefreshSlackChannels}
                        data-test="refresh-slack-channels"
                        title={t('Refresh channels')}
                        style={{ opacity: isRefreshing ? 0.5 : 1 }}
                      >
                        <Icons.SyncOutlined iconSize="l" spin={isRefreshing} />
                      </span>
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
