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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { SupersetClient, logging } from '@superset-ui/core';
import { Button, Input, Modal, Space, Tag } from '@superset-ui/core/components';
import { getDashboardPermalink } from 'src/utils/urlUtils';
import copyTextToClipboard from 'src/utils/copy';
import {
  isUserAdmin,
  isUserTeamAdmin,
} from 'src/dashboard/util/permissionUtils';
import {
  UserWithPermissionsAndRoles,
  UndefinedUser,
} from 'src/types/bootstrapTypes';
import { useSelector } from 'react-redux';
import { RootState } from 'src/dashboard/types';
import { hasStatefulCharts } from 'src/dashboard/util/chartStateConverter';
import { shallowEqual } from 'react-redux';

export type ShareDashboardModalProps = {
  dashboardId: number;
  dashboardTitle: string;
  show: boolean;
  onHide: () => void;
  addSuccessToast: (message: string) => void;
  addDangerToast: (message: string) => void;
  user?: UserWithPermissionsAndRoles | UndefinedUser;
};

const SectionTitle = styled.p`
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const LinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

const LinkInput = styled(Input)`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.grayscale.light4};
`;

const EmailInputRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.gridUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

const EmailTagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.gridUnit}px;
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
  min-height: ${({ theme }) => theme.gridUnit * 4}px;
`;

const HintText = styled.p`
  color: ${({ theme }) => theme.colors.grayscale.base};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  margin-bottom: 0;
`;

const ShareDashboardModal = ({
  dashboardId,
  dashboardTitle,
  show,
  onHide,
  addSuccessToast,
  addDangerToast,
  user,
}: ShareDashboardModalProps) => {
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [inviteEmails, setInviteEmails] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { dataMask, activeTabs, chartStates, sliceEntities } = useSelector(
    (state: RootState) => ({
      dataMask: state.dataMask,
      activeTabs: state.dashboardState.activeTabs,
      chartStates: state.dashboardState.chartStates,
      sliceEntities: state.sliceEntities?.slices,
    }),
    shallowEqual,
  );

  const canInviteUsers = useMemo(
    () => isUserAdmin(user) || isUserTeamAdmin(user),
    [user],
  );

  useEffect(() => {
    if (!show) return;

    const includeChartState =
      hasStatefulCharts(sliceEntities) &&
      chartStates &&
      Object.keys(chartStates).length > 0;

    getDashboardPermalink({
      dashboardId,
      dataMask,
      activeTabs,
      chartStates: includeChartState ? chartStates : undefined,
      includeChartState,
    })
      .then(result => {
        if (result?.url) setDashboardUrl(result.url);
      })
      .catch(err => {
        logging.error(err);
      });
  }, [show, dashboardId, dataMask, activeTabs, chartStates, sliceEntities]);

  const handleCopyLink = useCallback(async () => {
    try {
      await copyTextToClipboard(() => Promise.resolve(dashboardUrl));
      addSuccessToast(t('Copied to clipboard!'));
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Sorry, something went wrong. Try again later.'));
    }
  }, [dashboardUrl, addSuccessToast, addDangerToast]);

  const handleAddEmail = useCallback(() => {
    const trimmed = emailInput.trim();
    if (trimmed && !inviteEmails.includes(trimmed)) {
      setInviteEmails(prev => [...prev, trimmed]);
    }
    setEmailInput('');
  }, [emailInput, inviteEmails]);

  const handleEmailKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        handleAddEmail();
      }
    },
    [handleAddEmail],
  );

  const handleRemoveEmail = useCallback((email: string) => {
    setInviteEmails(prev => prev.filter(e => e !== email));
  }, []);

  const handleShare = useCallback(async () => {
    if (!canInviteUsers || inviteEmails.length === 0) {
      onHide();
      return;
    }

    setIsSubmitting(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/security/users/invite',
        jsonPayload: {
          emails: inviteEmails,
          dashboard_id: dashboardId,
          dashboard_url: dashboardUrl,
          dashboard_title: dashboardTitle,
        },
      });
      addSuccessToast(t('Invitation sent to %s', inviteEmails.join(', ')));
      onHide();
    } catch (error) {
      logging.error(error);
      addDangerToast(t('Failed to send invitations. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canInviteUsers,
    inviteEmails,
    dashboardId,
    dashboardUrl,
    dashboardTitle,
    addSuccessToast,
    addDangerToast,
    onHide,
  ]);

  const handleHide = useCallback(() => {
    setEmailInput('');
    setInviteEmails([]);
    onHide();
  }, [onHide]);

  const footer = (
    <Space>
      <Button
        key="cancel"
        buttonStyle="secondary"
        onClick={handleHide}
        data-test="share-dashboard-modal-cancel"
      >
        {t('Cancel')}
      </Button>
      <Button
        key="share"
        buttonStyle="primary"
        onClick={handleShare}
        loading={isSubmitting}
        disabled={canInviteUsers && inviteEmails.length === 0 && !dashboardUrl}
        data-test="share-dashboard-modal-share"
      >
        {t('Share')}
      </Button>
    </Space>
  );

  return (
    <Modal
      show={show}
      onHide={handleHide}
      title={t('Share dashboard')}
      footer={footer}
      data-test="share-dashboard-modal"
    >
      <SectionTitle>{t('Dashboard link')}</SectionTitle>
      <LinkRow>
        <LinkInput
          value={dashboardUrl}
          readOnly
          data-test="share-dashboard-url-input"
        />
        <Button
          buttonStyle="secondary"
          onClick={handleCopyLink}
          disabled={!dashboardUrl}
          data-test="share-dashboard-copy-link"
        >
          {t('Copy link')}
        </Button>
      </LinkRow>

      {canInviteUsers && (
        <>
          <SectionTitle>{t('Invite people')}</SectionTitle>
          <EmailTagsContainer data-test="share-dashboard-email-tags">
            {inviteEmails.map(email => (
              <Tag
                key={email}
                closable
                onClose={() => handleRemoveEmail(email)}
              >
                {email}
              </Tag>
            ))}
          </EmailTagsContainer>
          <EmailInputRow>
            <Input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              onBlur={handleAddEmail}
              placeholder={t('Enter email address')}
              data-test="share-dashboard-email-input"
            />
          </EmailInputRow>
          <HintText>
            {t('Press Enter or comma to add multiple email addresses.')}
          </HintText>
        </>
      )}
    </Modal>
  );
};

export default ShareDashboardModal;
