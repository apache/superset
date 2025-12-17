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

import { FC } from 'react';
import { useHistory } from 'react-router-dom';
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { AIInfoBanner, Button, Breadcrumb } from '@superset-ui/core/components';

const HeaderContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    background: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorder};
  `}
`;

const TopBar = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const LeftSection = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const RightSection = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const AIBannerWrapper = styled.div`
  ${({ theme }) => css`
    padding: 0 ${theme.sizeUnit * 4}px ${theme.sizeUnit * 3}px;
  `}
`;

interface TemplatePreviewHeaderProps {
  dashboardTitle: string;
  dashboardId: number;
}

export const TemplatePreviewHeader: FC<TemplatePreviewHeaderProps> = ({
  dashboardTitle,
  dashboardId,
}) => {
  const history = useHistory();

  const handleBackToTemplates = () => {
    history.push('/dashboard/templates/');
  };

  const handleUseTemplate = () => {
    // Navigate to datasource connector page with the dashboard_id
    history.push(`/datasource-connector/?dashboard_id=${dashboardId}`);
  };

  const breadcrumbItems = [
    {
      title: t('Dashboards'),
      href: '/dashboard/list/',
    },
    {
      title: t('Templates'),
      href: '/dashboard/templates/',
    },
    {
      title: dashboardTitle,
    },
  ];

  return (
    <HeaderContainer data-test="template-preview-header">
      <TopBar>
        <LeftSection>
          <Breadcrumb items={breadcrumbItems} />
        </LeftSection>
        <RightSection>
          <Button
            buttonStyle="tertiary"
            onClick={handleBackToTemplates}
            data-test="back-to-templates-button"
          >
            {t('Back to templates')}
          </Button>
          <Button
            buttonStyle="primary"
            onClick={handleUseTemplate}
            data-test="use-this-template-button"
          >
            {t('Use this template')}
          </Button>
        </RightSection>
      </TopBar>
      <AIBannerWrapper>
        <AIInfoBanner
          text={t(
            'This is a fully functioning dashboard that you can explore and test. If you use this as a template, you will be able to attach your real database connection to power this dashboard in no time.',
          )}
          data-test="template-preview-ai-hint"
        />
      </AIBannerWrapper>
    </HeaderContainer>
  );
};

export default TemplatePreviewHeader;
