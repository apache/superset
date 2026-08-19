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
import { t } from '@apache-superset/core/translation';
import { sanitizeHtml } from './html';

export type TooltipTruncationMode = 'off' | 'end' | 'start' | 'middle';

export const TRUNCATION_MAX_CHARS = 40;

const TRUNCATION_STYLE = `
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NOWRAP_STYLE = `
  white-space: nowrap;
`;

/**
 * Shortens plain text so a tooltip label stays readable, placing the ellipsis
 * where the caller asked for it.
 *
 * Only 'start' and 'middle' slice. 'end' is handled by CSS in tooltipHtml, and
 * 'off' means no truncation at all, so both return the input untouched.
 *
 * The input must be plain text. Callers are responsible for truncating before
 * any markup (such as the ECharts series marker) is prepended, and before
 * sanitization — slicing a string that already contains markup would cut into
 * a tag.
 */
export function truncateLabel(
  text: string,
  mode: TooltipTruncationMode = 'end',
): string {
  if (
    (mode !== 'start' && mode !== 'middle') ||
    text.length <= TRUNCATION_MAX_CHARS
  ) {
    return text;
  }
  const budget = TRUNCATION_MAX_CHARS - 1;
  if (mode === 'start') {
    return `…${text.slice(-budget)}`;
  }
  const head = Math.ceil(budget / 2);
  const tail = Math.floor(budget / 2);
  return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function getTruncationStyle(mode: TooltipTruncationMode): string {
  if (mode === 'end') {
    return TRUNCATION_STYLE;
  }
  if (mode === 'off') {
    return '';
  }
  // 'start' and 'middle' are already sliced upstream; keep them on one line.
  return NOWRAP_STYLE;
}

export function tooltipHtml(
  data: string[][],
  title?: string,
  focusedRow?: number,
  truncation: TooltipTruncationMode = 'end',
) {
  const truncationStyle = getTruncationStyle(truncation);
  const titleRow = title
    ? `<span style="font-weight: 700;${truncationStyle}">${title}</span>`
    : '';
  return sanitizeHtml(`
    <div>
      ${titleRow}
      <table>
          ${data.length === 0 ? `<tr><td>${t('No data')}</td></tr>` : ''}
          ${data
            .map((row, i) => {
              const rowStyle =
                i === focusedRow ? 'font-weight: 700;' : 'opacity: 0.8;';
              const cells = row.map((cell, j) => {
                const cellStyle = `
                  text-align: ${j > 0 ? 'right' : 'left'};
                  padding-left: ${j === 0 ? 0 : 16}px;
                  ${truncationStyle}
                `;
                return `<td style="${cellStyle}">${cell}</td>`;
              });
              return `<tr style="${rowStyle}">${cells.join('')}</tr>`;
            })
            .join('')}
      </table>
    </div>`);
}
