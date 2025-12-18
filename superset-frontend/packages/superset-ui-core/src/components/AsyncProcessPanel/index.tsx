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
import { styled, useTheme, css, keyframes } from '@apache-superset/core/ui';
import { Flex, Typography } from '../index';
import { Icons } from '../Icons';
import type { AsyncProcessPanelProps, ProcessStep } from './types';

const spin = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  ${({ theme }) => css`
    width: ${theme.sizeUnit * 20}px;
    height: ${theme.sizeUnit * 20}px;
    border: ${theme.sizeUnit}px solid ${theme.colorBgContainer};
    border-top: ${theme.sizeUnit}px solid ${theme.colorPrimary};
    border-radius: 50%;
    animation: ${spin} 1s linear infinite;
  `}
`;

const Subtitle = styled(Typography.Text)`
  ${() => css`
    display: block;
    text-align: center;
    max-width: 400px;
  `}
`;

const ProgressBarContainer = styled.div`
  ${({ theme }) => css`
    width: 100%;
    height: ${theme.sizeUnit * 1.5}px;
    background-color: ${theme.colorBgContainer};
    border-radius: ${theme.borderRadiusSM}px;
    overflow: hidden;
  `}
`;

const ProgressBar = styled.div<{ progress: number }>`
  ${({ theme, progress }) => css`
    height: 100%;
    width: ${progress}%;
    background: linear-gradient(
      90deg,
      ${theme.colorPrimary} 0%,
      ${theme.colorSuccess} 100%
    );
    border-radius: ${theme.borderRadiusSM}px;
    transition: width 0.5s ease-in-out;
  `}
`;

const StepsContainer = styled.div`
  ${({ theme }) => css`
    width: 100%;
    background-color: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.paddingLG}px;
  `}
`;

const StepIcon = styled.div<{ $isActive: boolean; $isCompleted: boolean }>`
  ${({ theme, $isActive, $isCompleted }) => css`
    width: ${theme.sizeUnit * 6}px;
    height: ${theme.sizeUnit * 6}px;
    min-width: ${theme.sizeUnit * 6}px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: ${theme.fontSizeSM}px;

    ${$isCompleted
      ? css`
          background-color: ${theme.colorSuccess};
          color: ${theme.colorTextLightSolid};
        `
      : $isActive
        ? css`
            background-color: ${theme.colorPrimary};
            color: ${theme.colorTextLightSolid};
          `
        : css`
            background-color: ${theme.colorBgBase};
            border: 1px solid ${theme.colorBorder};
            color: ${theme.colorTextSecondary};
          `}
  `}
`;

const StepTitle = styled.p<{ $isActive: boolean; $isCompleted: boolean }>`
  ${({ theme, $isActive, $isCompleted }) => css`
    font-size: ${theme.fontSize}px;
    font-weight: ${theme.fontWeightStrong};
    color: ${$isActive || $isCompleted
      ? theme.colorText
      : theme.colorTextSecondary};
    margin: 0 0 2px 0;
  `}
`;

const StepDescription = styled.p`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin: 0;
  `}
`;

const InfoBanner = styled.div`
  ${({ theme }) => css`
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
  ${({ theme }) => css`
    width: 100%;
    max-width: 600px;
    gap: ${theme.marginLG}px;
  `}
`;

const TitleSection = styled(Flex)`
  ${({ theme }) => css`
    gap: ${theme.marginSM}px;
  `}
`;

const StepsListContainer = styled(Flex)`
  ${({ theme }) => css`
    gap: ${theme.marginSM}px;
  `}
`;

const StepRow = styled(Flex)`
  ${({ theme }) => css`
    padding: ${theme.paddingSM}px 0;
    gap: ${theme.marginSM}px;
  `}
`;

const InfoBannerContent = styled(Flex)`
  ${({ theme }) => css`
    gap: ${theme.marginSM}px;
  `}
`;

const StepContent = styled(Flex)`
  flex: 1;
`;

export function AsyncProcessPanel({
  title,
  subtitle,
  steps,
  currentStepIndex,
  infoBannerTitle,
  infoBannerDescription,
}: AsyncProcessPanelProps) {
  const theme = useTheme();

  const progress = ((currentStepIndex + 1) / (steps.length + 1)) * 100;

  return (
    <PanelContainer vertical align="center">
      <Spinner />

      <TitleSection vertical align="center">
        <Typography.Title css={{ margin: 0, textAlign: 'center' }} level={3}>
          {title}
        </Typography.Title>
        {subtitle && <Subtitle type="secondary">{subtitle}</Subtitle>}
      </TitleSection>

      <ProgressBarContainer>
        <ProgressBar progress={progress} />
      </ProgressBarContainer>

      <StepsContainer>
        <StepsListContainer vertical>
          {steps.map((step, index) => {
            const isCompleted = currentStepIndex > index;
            const isActive = currentStepIndex === index;

            return (
              <StepRow key={step.key} align="flex-start">
                <StepIcon $isActive={isActive} $isCompleted={isCompleted}>
                  {isCompleted ? (
                    <Icons.CheckOutlined />
                  ) : isActive ? (
                    <Icons.LoadingOutlined />
                  ) : null}
                </StepIcon>
                <StepContent vertical>
                  <StepTitle $isActive={isActive} $isCompleted={isCompleted}>
                    {step.title}
                  </StepTitle>
                  <StepDescription>{step.description}</StepDescription>
                </StepContent>
              </StepRow>
            );
          })}
        </StepsListContainer>
      </StepsContainer>

      {(infoBannerTitle || infoBannerDescription) && (
        <InfoBanner>
          <InfoBannerContent align="flex-start">
            <InfoIcon>
              <Icons.InfoCircleOutlined
                iconSize="m"
                iconColor={theme.colorPrimary}
              />
            </InfoIcon>
            <StepContent vertical>
              {infoBannerTitle && (
                <Typography.Text
                  css={{ display: 'block', fontWeight: 600, marginBottom: 4 }}
                >
                  {infoBannerTitle}
                </Typography.Text>
              )}
              {infoBannerDescription && (
                <Typography.Text type="secondary">
                  {infoBannerDescription}
                </Typography.Text>
              )}
            </StepContent>
          </InfoBannerContent>
        </InfoBanner>
      )}
    </PanelContainer>
  );
}

export type { AsyncProcessPanelProps, ProcessStep };
