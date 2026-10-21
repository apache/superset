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
import { t, tn } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Tag } from '@superset-ui/core/components';
import type { DatasetDetail, NamedDiff } from './types';

const Block = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const Label = styled.div`
  ${({ theme }) => `
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
    margin-bottom: ${theme.sizeUnit}px;
  `}
`;

const Impact = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px;
    background: ${theme.colorInfoBg};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorText};
  `}
`;

const Name = styled.span`
  ${({ theme }) => `
    font-family: ${theme.fontFamilyCode};
  `}
`;

const Sql = styled.pre`
  ${({ theme }) => `
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0 0 ${theme.sizeUnit}px 0;
    padding: ${theme.sizeUnit}px;
    background: ${theme.colorBgLayout};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const Delta = styled.div`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin-left: ${theme.sizeUnit * 3}px;
  `}
`;

const Was = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    text-decoration: line-through;
  `}
`;

const Now = styled.span`
  ${({ theme }) => `
    color: ${theme.colorSuccessText};
  `}
`;

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function DiffList({ title, diff }: { title: string; diff?: NamedDiff }) {
  if (!diff) return null;
  const { added, changed, removed } = diff;
  if (!added.length && !changed.length && !removed.length) return null;
  return (
    <Block>
      <Label>{title}</Label>
      {added.map(item => (
        <div key={`a-${item.name}`}>
          <Tag color="green">{t('Added')}</Tag> <Name>{item.name}</Name>
        </div>
      ))}
      {removed.map(item => (
        <div key={`r-${item.name}`}>
          <Tag color="red">{t('Removed')}</Tag> <Name>{item.name}</Name>
        </div>
      ))}
      {changed.map(item => (
        <div key={`c-${item.name}`}>
          <Tag color="orange">{t('Changed')}</Tag> <Name>{item.name}</Name>
          {(item.fields ?? []).map(f => (
            <Delta key={f.field}>
              {f.field}: <Was>{show(f.before)}</Was> → <Now>{show(f.after)}</Now>
            </Delta>
          ))}
        </div>
      ))}
    </Block>
  );
}

/**
 * A dataset reviewed as a definition.
 *
 * Visa Q11 asks for a diff of columns, metrics and SQL rather than charts
 * rendered against the draft. A dataset change is a change to a contract,
 * and the contract is the thing to look at -- rendering one chart against it
 * would show a sample of the consequences and imply it was all of them.
 */
export default function DatasetReview({ detail }: { detail: DatasetDetail }) {
  // A dataset whose SQL did not move still carries an sql object, and
  // rendering it drew two empty rows reading "—" under an SQL heading --
  // which looks like the panel failed to load the one thing it exists to
  // show. Only a real difference earns the block.
  const sqlChanged =
    !!detail.sql && (detail.sql.before ?? '') !== (detail.sql.after ?? '');

  return (
    <div data-test="dataset-review">
      <Block>
        <Label>{t('Impact')}</Label>
        <Impact>
          {/* Pluralised properly: "Used by 1 charts" in a compliance
              review reads as a bug and undermines the number beside it. */}
          {t(
            'Used by %s on %s. Changes apply to all of them once approved.',
            tn('%s chart', '%s charts', detail.impact.charts, detail.impact.charts),
            tn(
              '%s dashboard',
              '%s dashboards',
              detail.impact.dashboards,
              detail.impact.dashboards,
            ),
          )}
        </Impact>
      </Block>

      {sqlChanged ? (
        <Block>
          <Label>{t('SQL')}</Label>
          <Was>
            <Sql>{show(detail.sql!.before)}</Sql>
          </Was>
          <Now>
            <Sql>{show(detail.sql!.after)}</Sql>
          </Now>
        </Block>
      ) : null}

      <DiffList title={t('Columns')} diff={detail.columns} />
      <DiffList title={t('Metrics')} diff={detail.metrics} />
    </div>
  );
}
