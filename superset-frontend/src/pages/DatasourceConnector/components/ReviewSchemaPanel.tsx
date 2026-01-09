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
import { t } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/ui';
import { Flex, Icons, Typography } from '@superset-ui/core/components';

interface ReviewSchemaPanelProps {
  databaseName: string | null;
  schemaName: string | null;
  onAnalysisComplete: (reportId: number) => void;
}

enum AnalysisStep {
  CONNECTING = 0,
  SCANNING = 1,
  ANALYZING = 2,
  AI_INTERPRETATION = 3,
  COMPLETE = 4,
}

const analysisSteps = [
  {
    key: AnalysisStep.CONNECTING,
    title: t('Connecting to database'),
    description: t('Establishing secure connection'),
  },
  {
    key: AnalysisStep.SCANNING,
    title: t('Scanning schema'),
    description: t('Discovering tables, views, and relationships'),
  },
  {
    key: AnalysisStep.ANALYZING,
    title: t('Analyzing structure'),
    description: t('Identifying primary keys, foreign keys, and data types'),
  },
  {
    key: AnalysisStep.AI_INTERPRETATION,
    title: t('AI interpretation'),
    description: t('Generating semantic descriptions for tables and columns'),
  },
];

const Spinner = styled.div`
  ${({ theme }) => `
    width: ${theme.sizeUnit * 20}px;
    height: ${theme.sizeUnit * 20}px;
    border: ${theme.sizeUnit}px solid ${theme.colorBgContainer};
    border-top: ${theme.sizeUnit}px solid ${theme.colorPrimary};
    border-radius: 50%;
    animation: spin 1s linear infinite;

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `}
`;

const Subtitle = styled(Typography.Text)`
  ${({ theme }) => `
    display: block;
    text-align: center;

    .database-name {
      color: ${theme.colorPrimary};
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

const ProgressBarContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    height: ${theme.sizeUnit * 1.5}px;
    background-color: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadiusSM}px;
    overflow: hidden;
  `}
`;

const ProgressBar = styled.div<{ progress: number }>`
  ${({ theme, progress }) => `
    height: 100%;
    width: ${progress}%;
    background: linear-gradient(90deg, ${theme.colorPrimary} 0%, ${theme.colorSuccess} 100%);
    border-radius: ${theme.borderRadiusSM}px;
    transition: width 0.5s ease-in-out;
  `}
`;

const StepsContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingLG}px;
  `}
`;

const StepIcon = styled.div<{ isActive: boolean; isCompleted: boolean }>`
  ${({ theme, isActive, isCompleted }) => `
    width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    min-width: ${theme.sizeUnit * 6}px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${theme.fontSizeSM}px;

    ${
      isCompleted
        ? `
      background-color: ${theme.colorSuccess};
      color: white;
    `
        : isActive
          ? `
      background-color: ${theme.colorPrimary};
      color: white;
    `
          : `
      background-color: ${theme.colorBgBase};
      border: 1px solid ${theme.colorBorder};
      color: ${theme.colorTextSecondary};
    `
    }
  `}
`;

const StepTitle = styled.p<{ isActive: boolean; isCompleted: boolean }>`
  ${({ theme, isActive, isCompleted }) => `
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${isActive || isCompleted ? theme.colorText : theme.colorTextSecondary};
    margin: 0 0 2px 0;
  `}
`;

const StepDescription = styled.p`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin: 0;
  `}
`;

const InfoBanner = styled.div`
  ${({ theme }) => `
    width: 100%;
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingMD}px ${theme.paddingLG}px;
  `}
`;

const InfoIcon = styled.div`
  margin-top: 2px;
  flex-shrink: 0;
`;

const PanelContainer = styled(Flex)`
  ${({ theme }) => `
    width: 100%;
    max-width: 600px;
    gap: ${theme.marginLG}px;
  `}
`;

const TitleSection = styled(Flex)`
  ${({ theme }) => `
    gap: ${theme.marginSM}px;
  `}
`;

const StepsListContainer = styled(Flex)`
  ${({ theme }) => `
    gap: ${theme.marginSM}px;
  `}
`;

const StepRow = styled(Flex)`
  ${({ theme }) => `
    padding: ${theme.paddingSM}px 0;
    gap: ${theme.marginSM}px;
  `}
`;

const InfoBannerContent = styled(Flex)`
  ${({ theme }) => `
    gap: ${theme.marginSM}px;
  `}
`;

const StepContent = styled(Flex)`
  flex: 1;
`;

export default function ReviewSchemaPanel({
  databaseName,
  schemaName: _schemaName,
  onAnalysisComplete,
}: ReviewSchemaPanelProps) {
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState<AnalysisStep>(
    AnalysisStep.CONNECTING,
  );

  // Simulate the analysis progress
  useEffect(() => {
    const stepDurations = [1500, 2000, 2500, 3000]; // ms for each step
    let timeoutId: NodeJS.Timeout;
    let completionTimeoutId: NodeJS.Timeout;

    const advanceStep = (step: AnalysisStep) => {
      if (step < AnalysisStep.COMPLETE) {
        timeoutId = setTimeout(() => {
          const nextStep = step + 1;
          setCurrentStep(nextStep);
          if (nextStep < AnalysisStep.COMPLETE) {
            advanceStep(nextStep);
          } else {
            // Analysis complete - trigger callback after a short delay
            // TODO: In real implementation, get the reportId from the analysis API
            // For now, use a placeholder reportId of 1
            completionTimeoutId = setTimeout(() => {
              onAnalysisComplete(1);
            }, 1000);
          }
        }, stepDurations[step]);
      }
    };

    advanceStep(AnalysisStep.CONNECTING);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (completionTimeoutId) {
        clearTimeout(completionTimeoutId);
      }
    };
  }, [onAnalysisComplete]);

  const progress = ((currentStep + 1) / (analysisSteps.length + 1)) * 100;

  return (
    <PanelContainer vertical align="center">
      <Spinner />

      <TitleSection vertical align="center">
        <Typography.Title css={{ margin: 0, textAlign: 'center' }} level={3}>
          {t('Analyzing database schema')}
        </Typography.Title>
        <Subtitle type="secondary">
          {t('Connected to')}{' '}
          <span className="database-name">{databaseName || 'database'}</span>
        </Subtitle>
      </TitleSection>

      <ProgressBarContainer>
        <ProgressBar progress={progress} />
      </ProgressBarContainer>

      <StepsContainer>
        <StepsListContainer vertical>
          {analysisSteps.map(step => {
            const isCompleted = currentStep > step.key;
            const isActive = currentStep === step.key;

            return (
              <StepRow key={step.key} align="flex-start">
                <StepIcon isActive={isActive} isCompleted={isCompleted}>
                  {isCompleted ? (
                    <Icons.CheckOutlined />
                  ) : isActive ? (
                    <Icons.LoadingOutlined />
                  ) : null}
                </StepIcon>
                <StepContent vertical>
                  <StepTitle isActive={isActive} isCompleted={isCompleted}>
                    {step.title}
                  </StepTitle>
                  <StepDescription>{step.description}</StepDescription>
                </StepContent>
              </StepRow>
            );
          })}
        </StepsListContainer>
      </StepsContainer>

      <InfoBanner>
        <InfoBannerContent align="flex-start">
          <InfoIcon>
            <Icons.InfoCircleOutlined
              iconSize="m"
              iconColor={theme.colorPrimary}
            />
          </InfoIcon>
          <StepContent vertical>
            <Typography.Text
              css={{ display: 'block', fontWeight: 600, marginBottom: 4 }}
            >
              {t('This may take a while for large databases')}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t(
                'AI is analyzing your schema to provide intelligent suggestions',
              )}
            </Typography.Text>
          </StepContent>
        </InfoBannerContent>
      </InfoBanner>
    </PanelContainer>
  );
}
