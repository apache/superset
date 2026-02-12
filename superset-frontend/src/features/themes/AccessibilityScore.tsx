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

import { useMemo, useState, useCallback } from 'react';
import { t } from '@apache-superset/core';
import { css, styled, useTheme } from '@apache-superset/core/ui';
import {
  Progress,
  Collapse,
  Tooltip,
  Button,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { Typography } from '@superset-ui/core/components/Typography';
import {
  analyzeThemeAccessibility,
  formatContrastRatio,
  getScoreColor,
  type AccessibilityAnalysis,
  type ContrastIssue,
  WCAG_REQUIREMENTS,
} from 'src/theme/accessibility';

interface AccessibilityScoreProps {
  /** JSON string of the theme configuration */
  themeJson: string | undefined;
}

const StyledContainer = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 4}px;
    padding: ${theme.sizeUnit * 3}px;
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const StyledHeader = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    margin-bottom: ${theme.sizeUnit * 2}px;

    .header-icon {
      font-size: ${theme.fontSizeLG}px;
    }

    .score-text {
      font-weight: ${theme.fontWeightStrong};
    }

    .level-badge {
      padding: 0 ${theme.sizeUnit}px;
      border-radius: ${theme.borderRadiusSM}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};

      &.level-aaa {
        background: ${theme.colorSuccessBg};
        color: ${theme.colorSuccess};
      }
      &.level-aa {
        background: ${theme.colorSuccessBg};
        color: ${theme.colorSuccess};
      }
      &.level-a {
        background: ${theme.colorWarningBg};
        color: ${theme.colorWarning};
      }
      &.level-fail {
        background: ${theme.colorErrorBg};
        color: ${theme.colorError};
      }
    }
  `}
`;

const StyledProgressWrapper = styled.div`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const StyledIssuesList = styled.div`
  ${({ theme }) => css`
    .issue-item {
      display: flex;
      align-items: flex-start;
      gap: ${theme.sizeUnit}px;
      padding: ${theme.sizeUnit}px 0;
      font-size: ${theme.fontSizeSM}px;

      &:not(:last-child) {
        border-bottom: 1px solid ${theme.colorBorderSecondary};
      }

      .issue-icon {
        flex-shrink: 0;
        margin-top: 2px;
      }

      .issue-icon-error {
        color: ${theme.colorError};
      }

      .issue-icon-warning {
        color: ${theme.colorWarning};
      }

      .issue-content {
        flex: 1;
      }

      .issue-tokens {
        font-family: ${theme.fontFamilyCode};
        color: ${theme.colorTextSecondary};
      }

      .issue-ratio {
        font-weight: ${theme.fontWeightStrong};
        color: ${theme.colorError};
      }

      .issue-required {
        color: ${theme.colorTextTertiary};
      }

      .color-swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 2px;
        border: 1px solid ${theme.colorBorder};
        vertical-align: middle;
        margin: 0 2px;
      }
    }

    .ant-collapse {
      background: transparent;
      border: none;
    }

    .ant-collapse-item {
      border: none !important;
    }

    .ant-collapse-header {
      padding: ${theme.sizeUnit}px 0 !important;
      color: ${theme.colorText} !important;
    }

    .ant-collapse-content {
      border: none !important;
    }

    .ant-collapse-content-box {
      padding: 0 !important;
    }
  `}
`;

const StyledEmptyState = styled.div`
  ${({ theme }) => css`
    text-align: center;
    color: ${theme.colorTextSecondary};
    padding: ${theme.sizeUnit * 2}px;
  `}
`;

/**
 * Renders a single contrast issue item
 */
function IssueItem({ issue }: { issue: ContrastIssue }) {
  const IconComponent =
    issue.severity === 'error'
      ? Icons.CloseCircleOutlined
      : Icons.ExclamationCircleOutlined;

  return (
    <div className="issue-item">
      <IconComponent
        className={`issue-icon issue-icon-${issue.severity}`}
        iconSize="s"
      />
      <div className="issue-content">
        <div>
          <span className="issue-tokens">
            {issue.foreground}
            <span
              className="color-swatch"
              style={{ backgroundColor: issue.foregroundColor }}
              title={issue.foregroundColor}
            />
          </span>
          {' vs '}
          <span className="issue-tokens">
            {issue.background}
            <span
              className="color-swatch"
              style={{ backgroundColor: issue.backgroundColor }}
              title={issue.backgroundColor}
            />
          </span>
        </div>
        <div>
          <span className="issue-ratio">
            {formatContrastRatio(issue.ratio)}
          </span>
          <span className="issue-required">
            {' '}
            ({t('need')} {formatContrastRatio(issue.required)})
          </span>
        </div>
        <Typography.Text type="secondary">{issue.description}</Typography.Text>
      </div>
    </div>
  );
}

/**
 * Checks if a key looks like a color token.
 */
function isColorKey(key: string): boolean {
  return (
    key.startsWith('color') ||
    key.startsWith('colorBg') ||
    key.startsWith('colorText')
  );
}

/**
 * Checks if a theme config has any meaningful color tokens defined.
 * Returns false for empty objects or objects with no color-related tokens.
 * Searches recursively through nested objects.
 */
function hasColorTokens(themeConfig: Record<string, unknown>): boolean {
  // Check if there's a token object with any color-related keys
  const token = themeConfig.token as Record<string, unknown> | undefined;
  if (token && typeof token === 'object') {
    const colorKeys = Object.keys(token).filter(isColorKey);
    if (colorKeys.length > 0) {
      return true;
    }
  }

  // Check root level for color keys
  const rootColorKeys = Object.keys(themeConfig).filter(isColorKey);
  if (rootColorKeys.length > 0) {
    return true;
  }

  // Check nested objects (e.g., neutrals, brand, semantic)
  for (const value of Object.values(themeConfig)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedObj = value as Record<string, unknown>;
      const nestedColorKeys = Object.keys(nestedObj).filter(isColorKey);
      if (nestedColorKeys.length > 0) {
        return true;
      }
    }
  }

  return false;
}

export interface ThemeAnalysisResult {
  analysis: AccessibilityAnalysis | null;
  hasColors: boolean;
  isValidJson: boolean;
  runAnalysis: () => void;
  resetAnalysis: () => void;
}

/**
 * Parses theme JSON synchronously (for immediate validation).
 */
function parseThemeJson(themeJson: string | undefined): {
  themeConfig: Record<string, unknown> | null;
  hasColors: boolean;
  isValidJson: boolean;
} {
  if (!themeJson || themeJson.trim() === '') {
    return { themeConfig: null, hasColors: false, isValidJson: false };
  }

  try {
    const themeConfig = JSON.parse(themeJson);
    if (typeof themeConfig !== 'object' || themeConfig === null) {
      return { themeConfig: null, hasColors: false, isValidJson: false };
    }

    const hasColors = hasColorTokens(themeConfig);
    return { themeConfig, hasColors, isValidJson: true };
  } catch {
    return { themeConfig: null, hasColors: false, isValidJson: false };
  }
}

/**
 * Parses theme JSON and provides a function to trigger analysis.
 * Analysis is triggered manually via the runAnalysis function.
 */
export function useThemeAnalysis(
  themeJson: string | undefined,
): ThemeAnalysisResult {
  const [analysis, setAnalysis] = useState<AccessibilityAnalysis | null>(null);

  // Immediate parsing for validation
  const parsed = useMemo(() => parseThemeJson(themeJson), [themeJson]);

  const runAnalysis = useCallback(() => {
    const { themeConfig, hasColors, isValidJson } = parsed;

    if (!isValidJson || !hasColors || !themeConfig) {
      return;
    }

    const result = analyzeThemeAccessibility(themeConfig);
    setAnalysis(result);
  }, [parsed]);

  const resetAnalysis = useCallback(() => {
    setAnalysis(null);
  }, []);

  return {
    analysis,
    hasColors: parsed.hasColors,
    isValidJson: parsed.isValidJson,
    runAnalysis,
    resetAnalysis,
  };
}

interface AccessibilityScoreResultsProps {
  analysis: AccessibilityAnalysis;
  onReanalyze: () => void;
}

/**
 * AccessibilityScoreResults component displays WCAG contrast analysis results.
 * Only renders when there's an analysis to show.
 *
 * Features:
 * - Score from 0-100 based on contrast checks
 * - WCAG compliance level (AAA, AA, A, Fail)
 * - List of specific contrast issues with color swatches
 * - Collapsible issues list for clean UI
 */
export function AccessibilityScoreResults({
  analysis,
  onReanalyze,
}: AccessibilityScoreResultsProps): JSX.Element | null {
  const theme = useTheme();

  // Show message when no checkable pairs found
  if (analysis.totalChecks === 0) {
    return (
      <StyledContainer>
        <StyledHeader>
          <Icons.InfoCircleOutlined className="header-icon" />
          <Typography.Text className="score-text">
            {t('Accessibility')}
          </Typography.Text>
        </StyledHeader>
        <StyledEmptyState>
          <Typography.Text type="secondary">
            {t('No contrast pairs found to analyze.')}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            css={css`
              display: block;
              margin-top: 4px;
              font-size: 12px;
            `}
          >
            {t('Try adding: colorText, colorBgBase, colorPrimary')}
          </Typography.Text>
          <Button
            onClick={onReanalyze}
            icon={<Icons.ReloadOutlined />}
            buttonStyle="tertiary"
            css={css`
              margin-top: 8px;
            `}
          >
            {t('Re-analyze')}
          </Button>
        </StyledEmptyState>
      </StyledContainer>
    );
  }

  const { score, level, issues, passedChecks, totalChecks } = analysis;
  const scoreColor = getScoreColor(score);
  const hasIssues = issues.length > 0;

  const levelClassName = `level-${level.toLowerCase()}`;

  const collapseItems = hasIssues
    ? [
        {
          key: 'issues',
          label: (
            <span>
              <Icons.WarningOutlined
                css={css`
                  margin-right: 4px;
                `}
              />
              {t('%s contrast issue(s)', issues.length)}
            </span>
          ),
          children: (
            <>
              {issues.map((issue, index) => (
                <IssueItem
                  key={`${issue.foreground}-${issue.background}-${index}`}
                  issue={issue}
                />
              ))}
            </>
          ),
        },
      ]
    : [];

  return (
    <StyledContainer>
      <StyledHeader>
        <Tooltip
          title={t(
            'WCAG 2.1 contrast analysis. AA requires %s:1 for normal text.',
            WCAG_REQUIREMENTS.AA_NORMAL_TEXT,
          )}
        >
          <Icons.InfoCircleOutlined className="header-icon" />
        </Tooltip>
        <Typography.Text className="score-text">
          {t('Accessibility')}:
        </Typography.Text>
        <Typography.Text className="score-text">{score}/100</Typography.Text>
        <span className={`level-badge ${levelClassName}`}>{level}</span>
        <Typography.Text type="secondary">
          ({passedChecks}/{totalChecks} {t('checks passed')})
        </Typography.Text>
        <Tooltip title={t('Re-analyze')}>
          <Button
            onClick={onReanalyze}
            icon={<Icons.ReloadOutlined />}
            buttonStyle="link"
            buttonSize="xsmall"
          />
        </Tooltip>
      </StyledHeader>

      <StyledProgressWrapper>
        <Progress
          percent={score}
          status={scoreColor === 'error' ? 'exception' : undefined}
          strokeColor={
            scoreColor === 'success'
              ? undefined
              : scoreColor === 'warning'
                ? theme.colorWarning
                : undefined
          }
          showInfo={false}
          size="small"
        />
      </StyledProgressWrapper>

      <StyledIssuesList>
        {hasIssues ? (
          <Collapse
            ghost
            items={collapseItems}
            defaultActiveKey={issues.length <= 3 ? ['issues'] : []}
          />
        ) : (
          <StyledEmptyState>
            <Icons.CheckCircleOutlined
              css={css`
                color: ${theme.colorSuccess};
                margin-right: 8px;
              `}
            />
            {t('All contrast checks passed!')}
          </StyledEmptyState>
        )}
      </StyledIssuesList>
    </StyledContainer>
  );
}

/**
 * AccessibilityScore component - wrapper that uses the hook internally.
 * Only renders when there's an analysis to show.
 */
export function AccessibilityScore({
  themeJson,
}: AccessibilityScoreProps): JSX.Element | null {
  const { analysis, runAnalysis } = useThemeAnalysis(themeJson);

  if (!analysis) {
    return null;
  }

  return (
    <AccessibilityScoreResults analysis={analysis} onReanalyze={runAnalysis} />
  );
}

export default AccessibilityScore;
