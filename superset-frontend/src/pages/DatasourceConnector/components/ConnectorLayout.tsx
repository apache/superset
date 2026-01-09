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
import { ReactNode } from 'react';
import { t } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/ui';
import {
  AIInfoBanner,
  Flex,
  Icons,
  Typography,
} from '@superset-ui/core/components';
import { ConnectorStep } from '../types';

interface ConnectorLayoutProps {
  currentStep: ConnectorStep;
  children: ReactNode;
  templateName?: string | null;
  databaseName?: string | null;
}

const PageContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 56px);
    background-color: ${theme.colorBgBase};
  `}
`;

const PageHeader = styled.div`
  ${({ theme }) => `
    padding: ${theme.paddingMD}px ${theme.paddingLG}px;
    background-color: ${theme.colorBgContainer};
    border-bottom: 1px solid ${theme.colorBorder};


  `}
`;

const StepsContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: center;
    padding: ${theme.paddingXL}px 0;
    background-color: ${theme.colorBgBase};
  `}
`;

const StepCircle = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  ${({ theme, isActive, isCompleted }) => `
    width: ${theme.sizeUnit * 8}px;
    height: ${theme.sizeUnit * 8}px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    ${
      isActive || isCompleted
        ? `
      background-color: ${theme.colorPrimary};
      color: white;
    `
        : `
      background-color: transparent;
      border: 2px solid ${theme.colorTextSecondary};
      color: ${theme.colorTextSecondary};
    `
    }
  `}
`;

const StepTitle = styled.span<{ isActive: boolean; isCompleted: boolean }>`
  ${({ theme, isActive, isCompleted }) => `
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${isActive || isCompleted ? theme.colorText : theme.colorTextSecondary};
    white-space: nowrap;
  `}
`;

const StepConnector = styled.div<{ isCompleted: boolean }>`
  ${({ theme, isCompleted }) => `
    width: ${theme.sizeUnit * 20}px;
    height: 1px;
    background-color: ${isCompleted ? theme.colorPrimary : theme.colorBorderSecondary};
    margin: 0 ${theme.marginMD}px;
  `}
`;

const ContentContainer = styled(Flex)`
  ${({ theme }) => `
    flex: 1;
    padding: ${theme.paddingLG}px;
  `}
`;

const AIBannerWrapper = styled.div`
  ${({ theme }) => css`
    width: 100%;
    max-width: 600px;
    margin-bottom: ${theme.marginLG}px;
  `}
`;

interface StepConfig {
  title: string;
  icon: ReactNode;
}

const stepsConfig: StepConfig[] = [
  {
    title: t('Connect Data Source'),
    icon: <Icons.DatabaseOutlined iconSize="m" />,
  },
  {
    title: t('Review Schema'),
    icon: <Icons.SearchOutlined iconSize="m" />,
  },
  {
    title: t('Generate Dashboard'),
    icon: <Icons.DashboardOutlined iconSize="m" />,
  },
];

// Map internal steps to visual step index
// EDIT_SCHEMA is visually part of "Review Schema" step
// REVIEW_MAPPINGS and REVIEW_PENDING are visually part of "Generate Dashboard" step
function getVisualStepIndex(step: ConnectorStep): number {
  switch (step) {
    case ConnectorStep.CONNECT_DATA_SOURCE:
      return 0;
    case ConnectorStep.REVIEW_SCHEMA:
    case ConnectorStep.EDIT_SCHEMA:
      return 1;
    case ConnectorStep.REVIEW_MAPPINGS:
    case ConnectorStep.GENERATE_DASHBOARD:
    case ConnectorStep.REVIEW_PENDING:
      return 2;
    default:
      return 0;
  }
}

function getAIBannerText(
  currentStep: ConnectorStep,
  templateName?: string | null,
  databaseName?: string | null,
): string | null {
  switch (currentStep) {
    case ConnectorStep.CONNECT_DATA_SOURCE:
      return templateName
        ? t(
            'Choose a database connection to power the "%s" dashboard. AI will analyze your database schema and automatically connect the dashboard to your real data.',
            templateName,
          )
        : null;
    case ConnectorStep.REVIEW_SCHEMA:
      return databaseName
        ? t(
            'AI is analyzing your "%s" database schema. This may take a while for large databases.',
            databaseName,
          )
        : t(
            'AI is analyzing your database schema. This may take a while for large databases.',
          );
    case ConnectorStep.EDIT_SCHEMA:
      return t(
        'Review and edit the AI-generated schema descriptions below before generating your dashboard.',
      );
    case ConnectorStep.REVIEW_MAPPINGS:
      return t(
        'AI needs your help to map some columns. Please review the suggestions below.',
      );
    case ConnectorStep.GENERATE_DASHBOARD:
      return templateName
        ? t(
            'AI is customizing your dashboard from the "%s" template. The template is being adapted to match your data schema and generate meaningful visualizations.',
            templateName,
          )
        : t(
            'AI is customizing your dashboard. The template is being adapted to match your data schema and generate meaningful visualizations.',
          );
    default:
      return null;
  }
}
export default function ConnectorLayout({
  currentStep,
  children,
  templateName,
  databaseName,
}: ConnectorLayoutProps) {
  const visualStep = getVisualStepIndex(currentStep);
  const bannerText = getAIBannerText(currentStep, templateName, databaseName);

  return (
    <PageContainer>
      <PageHeader>
        <Typography.Title css={{ margin: 0 }} level={3}>
          {t('Create Dashboard from Template')}
        </Typography.Title>
      </PageHeader>
      <StepsContainer>
        <Flex align="center" gap={0}>
          {stepsConfig.map((step, index) => {
            const isActive = index === visualStep;
            const isCompleted = index < visualStep;

            return (
              <Flex key={step.title} align="center" gap={8}>
                <StepCircle isActive={isActive} isCompleted={isCompleted}>
                  {isActive || isCompleted ? step.icon : index + 1}
                </StepCircle>
                <StepTitle isActive={isActive} isCompleted={isCompleted}>
                  {step.title}
                </StepTitle>
                {index < stepsConfig.length - 1 && (
                  <StepConnector isCompleted={isCompleted} />
                )}
              </Flex>
            );
          })}
        </Flex>
      </StepsContainer>
      <ContentContainer vertical align="center">
        {bannerText && (
          <AIBannerWrapper>
            <AIInfoBanner
              text={bannerText}
              data-test="datasource-connector-ai-hint"
            />
          </AIBannerWrapper>
        )}
        {children}
      </ContentContainer>
    </PageContainer>
  );
}
