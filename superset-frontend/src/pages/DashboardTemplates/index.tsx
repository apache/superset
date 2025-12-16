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

import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { SupersetClient, t, logging } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import { navigateTo } from 'src/utils/navigationUtils';
import { DashboardTemplateGallery } from './DashboardTemplateGallery';
import { DashboardTemplate } from './types';

const PageContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${theme.colorBgLayout};
  `}
`;

const PageHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    padding: ${theme.sizeUnit * 4}px;
    background: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorder};
  `}
`;

const PageTitle = styled.h2`
  ${({ theme }) => css`
    margin: 0;
    font-size: ${theme.fontSizeHeading3}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorText};
  `}
`;

const PageSubtitle = styled.p`
  ${({ theme }) => css`
    margin: ${theme.sizeUnit}px 0 0;
    font-size: ${theme.fontSize}px;
    color: ${theme.colorTextSecondary};
  `}
`;

export default function DashboardTemplates() {
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const history = useHistory();

  useEffect(() => {
    SupersetClient.get({
      endpoint: '/api/v1/dashboard/templates',
    })
      .then(({ json }) => {
        setTemplates(json.result);
      })
      .catch(error => {
        logging.error('Error fetching templates:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSelectTemplate = (template: DashboardTemplate | null) => {
    if (template === null || template.id === null) {
      // /dashboard/new/ is a backend Flask route that creates a new dashboard
      // and redirects to the edit mode. Use full page navigation.
      navigateTo('/dashboard/new/');
    } else {
      // Existing templates - use React Router for SPA navigation
      history.push(`/superset/dashboard/${template.uuid}/`);
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>{t('Dashboard Templates')}</PageTitle>
        <PageSubtitle>
          {t('Choose a template to get started or create a blank dashboard')}
        </PageSubtitle>
      </PageHeader>
      <DashboardTemplateGallery
        templates={templates}
        loading={loading}
        onSelectTemplate={handleSelectTemplate}
      />
    </PageContainer>
  );
}
