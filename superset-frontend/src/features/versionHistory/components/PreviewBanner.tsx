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
import { css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Button, Icons } from '@superset-ui/core/components';

interface Props {
  summary: string;
  date: string;
  onRestore: () => void;
  onExit: () => void;
  restoring?: boolean;
}

const PreviewBanner = ({
  summary,
  date,
  onRestore,
  onExit,
  restoring,
}: Props) => {
  const theme = useTheme();
  return (
    <div
      data-test="version-preview-banner"
      role="region"
      aria-label={t('Previewing historical version')}
      css={css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 3}px;
        padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
        background: ${theme.colorInfoBg};
        border-bottom: 1px solid ${theme.colorInfoBorder};
        color: ${theme.colorText};
      `}
    >
      <Icons.HistoryOutlined iconSize="l" />
      <div
        css={css`
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `}
      >
        <strong>{t('Previewing historical version')}</strong>
        {' · '}
        <span title={summary}>{summary}</span>
        {' · '}
        <span>{date}</span>
      </div>
      <Button
        buttonStyle="primary"
        buttonSize="small"
        onClick={onRestore}
        loading={restoring}
        data-test="version-preview-restore"
      >
        {t('Restore this version')}
      </Button>
      <Button
        buttonStyle="secondary"
        buttonSize="small"
        onClick={onExit}
        data-test="version-preview-exit"
      >
        {t('Exit preview')}
      </Button>
    </div>
  );
};

export default PreviewBanner;
