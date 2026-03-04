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
import { cloneElement, ReactElement, useCallback } from 'react';
import { t } from '@apache-superset/core';
import { css, SupersetTheme } from '@apache-superset/core/ui';
import copyTextToClipboard from 'src/utils/copy';
import { Tooltip } from '@superset-ui/core/components';
import withToasts from '../MessageToasts/withToasts';
import type { CopyToClipboardProps } from './types';

function CopyToClip({
  copyNode = <span>{t('Copy')}</span>,
  onCopyEnd = () => {},
  shouldShowText = true,
  wrapped = true,
  tooltipText = t('Copy to clipboard'),
  hideTooltip = false,
  getText,
  text,
  addSuccessToast,
  addDangerToast,
}: CopyToClipboardProps) {
  const copyToClipboard = useCallback(
    (textToCopy: Promise<string>) => {
      copyTextToClipboard(() => textToCopy)
        .then(() => {
          addSuccessToast(t('Copied to clipboard!'));
        })
        .catch(() => {
          addDangerToast(
            t(
              'Sorry, your browser does not support copying. Use Ctrl / Cmd + C!',
            ),
          );
        })
        .finally(() => {
          if (onCopyEnd) onCopyEnd();
        });
    },
    [addSuccessToast, addDangerToast, onCopyEnd],
  );

  const onClick = useCallback(() => {
    if (getText) {
      getText((d: string) => {
        copyToClipboard(Promise.resolve(d));
      });
    } else {
      copyToClipboard(Promise.resolve(text || ''));
    }
  }, [getText, text, copyToClipboard]);

  const getDecoratedCopyNode = useCallback(
    () =>
      cloneElement(copyNode as ReactElement, {
        style: { cursor: 'pointer' },
        onClick,
      }),
    [copyNode, onClick],
  );

  const renderTooltip = useCallback(
    (cursor: string) => (
      <>
        {!hideTooltip ? (
          <Tooltip
            id="copy-to-clipboard-tooltip"
            placement="topRight"
            style={{ cursor }}
            title={tooltipText || ''}
            trigger={['hover']}
            arrow={{ pointAtCenter: true }}
          >
            {getDecoratedCopyNode()}
          </Tooltip>
        ) : (
          getDecoratedCopyNode()
        )}
      </>
    ),
    [hideTooltip, tooltipText, getDecoratedCopyNode],
  );

  const renderNotWrapped = useCallback(
    () => renderTooltip('pointer'),
    [renderTooltip],
  );

  const renderLink = useCallback(
    () => (
      <span css={{ display: 'inline-flex', alignItems: 'center' }}>
        {shouldShowText && text && (
          <span
            data-test="short-url"
            css={(theme: SupersetTheme) => css`
              margin-right: ${theme.sizeUnit}px;
            `}
          >
            {text}
          </span>
        )}
        {renderTooltip('pointer')}
      </span>
    ),
    [shouldShowText, text, renderTooltip],
  );

  if (!wrapped) {
    return renderNotWrapped();
  }
  return renderLink();
}

export const CopyToClipboard = withToasts(CopyToClip);
export type { CopyToClipboardProps };
