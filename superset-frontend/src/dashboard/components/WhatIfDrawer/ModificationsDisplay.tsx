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

import { memo, useState, useCallback } from 'react';
import { t } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Tag } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { formatPercentageChange } from 'src/dashboard/util/whatIf';
import { ExtendedWhatIfModification } from './types';
import {
  ModificationsSection,
  ModificationTagsContainer,
  AIBadge,
  AIReasoningSection,
  AIReasoningToggle,
  AIReasoningContent,
  AIReasoningItem,
} from './styles';

interface ModificationsDisplayProps {
  modifications: ExtendedWhatIfModification[];
}

/**
 * Component for displaying applied modifications as tags with AI reasoning.
 * Uses memo to prevent unnecessary re-renders when modifications haven't changed.
 */
const ModificationsDisplay = memo(function ModificationsDisplay({
  modifications,
}: ModificationsDisplayProps) {
  const theme = useTheme();
  const [showAIReasoning, setShowAIReasoning] = useState(false);

  const toggleAIReasoning = useCallback(() => {
    setShowAIReasoning(prev => !prev);
  }, []);

  const hasAIReasoning = modifications.some(mod => mod.reasoning);

  if (modifications.length === 0) {
    return null;
  }

  return (
    <ModificationsSection>
      <ModificationTagsContainer>
        {modifications.map((mod, idx) => (
          <Tag
            key={idx}
            css={css`
              display: inline-flex;
              align-items: center;
              gap: ${theme.sizeUnit}px;
              margin: 0;
            `}
          >
            <span>{mod.verboseName || mod.column}</span>
            {mod.isAISuggested && <AIBadge>{t('AI')}</AIBadge>}
            <span
              css={css`
                font-weight: ${theme.fontWeightStrong};
                color: ${mod.multiplier >= 1
                  ? theme.colorSuccess
                  : theme.colorError};
              `}
            >
              {formatPercentageChange(mod.multiplier, 0)}
            </span>
          </Tag>
        ))}
      </ModificationTagsContainer>

      {hasAIReasoning && (
        <AIReasoningSection>
          <AIReasoningToggle onClick={toggleAIReasoning}>
            {showAIReasoning ? (
              <Icons.DownOutlined iconSize="xs" />
            ) : (
              <Icons.RightOutlined iconSize="xs" />
            )}
            {t('How AI chose these')}
          </AIReasoningToggle>
          {showAIReasoning && (
            <AIReasoningContent>
              {modifications
                .filter(mod => mod.reasoning)
                .map((mod, idx) => (
                  <AIReasoningItem key={idx}>
                    <strong>
                      {mod.verboseName || mod.column}{' '}
                      {formatPercentageChange(mod.multiplier, 0)}
                    </strong>
                    <div>{mod.reasoning}</div>
                  </AIReasoningItem>
                ))}
            </AIReasoningContent>
          )}
        </AIReasoningSection>
      )}
    </ModificationsSection>
  );
});

export default ModificationsDisplay;
