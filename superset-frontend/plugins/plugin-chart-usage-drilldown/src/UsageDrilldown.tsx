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
import { Fragment, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import type { DataRecordValue } from '@superset-ui/core';
import { Tooltip } from '@superset-ui/core/components';
import type { UsageDrilldownProps } from './types';
import { DURATION_RUNS, DURATION_TOTAL } from './consts';
import { notifyEmbedHost } from './notifyEmbedHost';

const PAGE_SIZE = 10;

const Wrapper = styled.div<{ height: number }>`
  ${({ theme, height }) => `
    --ud-text: ${theme.colorText};
    --ud-muted: #7a786f;
    --ud-border: #ebe8e1;
    --ud-head-bg: #faf9f6;
    --ud-hover: #f7f5f0;
    --ud-track: #f1eee6;
    --ud-bar: #4d6aa3;
    --ud-link: #2f5d4e;
    --ud-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

    height: ${height}px;
    overflow: auto;
    color: var(--ud-text);

    .ud-card {
      border: 1px solid var(--ud-border);
      border-radius: 12px;
      background: ${theme.colorBgContainer};
      overflow: hidden;
    }

    .ud-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding: 18px 14px 14px;
    }

    .ud-title {
      margin: 0 0 14px;
      font-size: 13px;
      font-weight: 600;
    }

    .ud-breadcrumb {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }

    .ud-crumb,
    .ud-more button {
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      cursor: pointer;
    }

    .ud-crumb {
      color: var(--ud-link);
    }

    .ud-crumb:hover {
      color: var(--ud-text);
      text-decoration: underline;
    }

    .ud-crumb-current {
      font-weight: 500;
    }

    .ud-crumb-sep {
      color: var(--ud-muted);
    }

    .ud-tools {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ud-hint {
      font-size: 11px;
      color: var(--ud-muted);
      white-space: nowrap;
    }

    .ud-search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 240px;
      height: 30px;
      padding: 0 12px;
      border: 1px solid var(--ud-border);
      border-radius: 8px;
    }

    .ud-search:focus-within {
      border-color: var(--ud-bar);
    }

    .ud-search svg {
      width: 13px;
      height: 13px;
      flex: none;
      fill: none;
      stroke: var(--ud-muted);
      stroke-width: 2;
      stroke-linecap: round;
    }

    .ud-search input {
      width: 100%;
      border: 0;
      outline: 0;
      background: none;
      color: var(--ud-text);
      font: inherit;
      font-size: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      padding: 10px 14px;
      background: var(--ud-head-bg);
      border-top: 1px solid var(--ud-border);
      border-bottom: 1px solid var(--ud-border);
      color: var(--ud-muted);
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-align: left;
      text-transform: uppercase;
    }

    td {
      padding: 8px 14px;
      border-bottom: 1px solid var(--ud-border);
      vertical-align: middle;
    }

    .ud-num {
      width: 1%;
      padding-right: 6px;
      text-align: right;
      white-space: nowrap;
    }

    .ud-share-col {
      width: 34%;
      padding-left: 6px;
    }

    .ud-chevron-col {
      width: 24px;
      color: var(--ud-muted);
      font-size: 16px;
      text-align: center;
    }

    tr.ud-clickable {
      cursor: pointer;
    }

    tr.ud-clickable:hover td {
      background: var(--ud-hover);
    }

    .ud-name {
      font-size: 13px;
      font-weight: 500;
    }

    .ud-sub {
      margin-top: 2px;
      color: var(--ud-muted);
      font-size: 11px;
    }

    .ud-sub a {
      color: var(--ud-link);
    }

    .ud-mono {
      font-family: var(--ud-mono);
      font-size: 12px;
    }

    .ud-share {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .ud-share .ud-mono {
      width: 48px;
      color: var(--ud-muted);
      font-size: 10px;
      text-align: right;
    }

    .ud-bar {
      flex: 1;
      height: 6px;
      border-radius: 3px;
      background: var(--ud-track);
      overflow: hidden;
    }

    .ud-bar-fill {
      min-width: 3px;
      height: 100%;
      border-radius: 3px;
      background: var(--ud-bar);
    }

    .ud-empty {
      padding: 32px 14px;
      color: var(--ud-muted);
      text-align: center;
    }

    .ud-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
      color: var(--ud-muted);
      font-size: 11px;
    }

    .ud-more {
      display: flex;
      gap: 14px;
    }

    .ud-api {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ud-badge {
      flex: none;
      min-width: 38px;
      padding: 3px 5px;
      border-radius: 4px;
      background: #eeece6;
      color: #55534c;
      font-family: var(--ud-mono);
      font-size: 9px;
      font-weight: 700;
      text-align: center;
      text-transform: uppercase;
    }

    .ud-badge-get {
      background: #e6f1ea;
      color: #2f6b46;
    }

    .ud-badge-post {
      background: #e6eaf4;
      color: #3a538a;
    }

    .ud-badge-put,
    .ud-badge-patch {
      background: #f8f0d8;
      color: #86661a;
    }

    .ud-badge-delete {
      background: #f8e4e1;
      color: #9a3b31;
    }

    .ud-sub-mono {
      font-family: var(--ud-mono);
      font-size: 10px;
    }

    .ud-duration {
      width: 1%;
      padding-right: 54px;
      text-align: right;
      white-space: nowrap;
    }

    .ud-more button {
      color: var(--ud-link);
      font-weight: 500;
    }

    .ud-more button:hover {
      text-decoration: underline;
    }
  `}
`;

interface Row {
  value: DataRecordValue;
  total: number;
  share: number;
  children: Set<DataRecordValue>;
  links: Set<string>;
  badges: Set<string>;
  subtitles: Set<string>;
  durationTotal: number;
  durationRuns: number;
}

// The link column may be a plain URL or an <a href="..."> tag.
function hrefOf(value: DataRecordValue): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value);
  return /href="([^"]+)"/.exec(text)?.[1] ?? (text.trim() || undefined);
}

const display = (value: DataRecordValue) =>
  value === null || value === undefined ? t('<NULL>') : String(value);

// The dataset labels groups with no real entity behind them in parentheses,
// e.g. "(not in a workflow)" or "(no workflows)". They have nothing to drill
// into, so they are shown but cannot be opened.
const isPlaceholder = (value: DataRecordValue) =>
  typeof value === 'string' && /^\(.*\)$/.test(value.trim());

// Placeholder labels from the dataset that show as "-", with an explanation
// on hover: "(not in a workflow)" groups calls recorded before workflows were
// tracked, "(no workflows)" stands for a project without any workflows.
const hints: Record<string, () => string> = {
  '(not in a workflow)': () =>
    t(
      'These API calls are from older records that were saved without workflow details, so their workflow cannot be shown.',
    ),
  '(no workflows)': () =>
    t('This project has no workflows, so there is nothing to show here.'),
};

const hint = (value: DataRecordValue) =>
  typeof value === 'string' ? hints[value]?.() : undefined;

const name = (value: DataRecordValue) =>
  hint(value) === undefined ? display(value) : '-';

// "Project" -> "projects", "API" -> "APIs"
const plural = (label: string) =>
  label === label.toUpperCase() ? `${label}s` : `${label.toLowerCase()}s`;

// "Project" -> "project", but acronyms like "API" stay as they are.
const lower = (label: string) =>
  label === label.toUpperCase() ? label : label.toLowerCase();

// 1 -> "1 workflow", 3 -> "3 workflows"
const count = (n: number, label: string) =>
  `${n} ${n === 1 ? lower(label) : plural(label)}`;

export default function UsageDrilldown({
  height,
  data,
  levels,
  metricKey,
  metricLabel,
  linkKey,
  badgeKey,
  subtitleKeys,
  hasDuration,
  titlePrefix,
}: UsageDrilldownProps) {
  // Values chosen at each level so far; its length is the current depth.
  const [path, setPath] = useState<DataRecordValue[]>([]);
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const goTo = (newPath: DataRecordValue[]) => {
    setPath(newPath);
    setSearch('');
    setVisible(PAGE_SIZE);
  };

  // New data (filters, refresh) may not contain the old selection.
  useEffect(() => goTo([]), [data]);
  useEffect(() => notifyEmbedHost('usage_drilldown'), [data]);

  const depth = Math.min(path.length, levels.length - 1);
  const level = levels[depth];
  const next = levels[depth + 1];

  const rows = useMemo<Row[]>(() => {
    if (!level) return [];
    const grouped = new Map<DataRecordValue, Row>();

    data
      .filter(record =>
        path.every((value, i) => record[levels[i].key] === value),
      )
      .forEach(record => {
        const value = record[level.key];
        const row = grouped.get(value) ?? {
          value,
          total: 0,
          share: 0,
          children: new Set<DataRecordValue>(),
          links: new Set<string>(),
          badges: new Set<string>(),
          subtitles: new Set<string>(),
          durationTotal: 0,
          durationRuns: 0,
        };
        row.total += Number(record[metricKey]) || 0;
        if (next) row.children.add(record[next.key]);
        const href = linkKey ? hrefOf(record[linkKey]) : undefined;
        if (href) row.links.add(href);
        const badge = badgeKey ? record[badgeKey] : undefined;
        if (badge !== null && badge !== undefined && badge !== '') {
          row.badges.add(String(badge));
        }
        const subtitle = subtitleKeys
          .map(key => record[key])
          .filter(
            value => value !== null && value !== undefined && value !== '',
          )
          .join(' · ');
        if (subtitle) row.subtitles.add(subtitle);
        row.durationTotal += Number(record[DURATION_TOTAL]) || 0;
        row.durationRuns += Number(record[DURATION_RUNS]) || 0;
        grouped.set(value, row);
      });

    const result = [...grouped.values()].sort((a, b) => b.total - a.total);
    const total = result.reduce((sum, row) => sum + row.total, 0);
    result.forEach(row => {
      row.share = total ? (row.total / total) * 100 : 0;
    });
    return result;
  }, [
    data,
    levels,
    level,
    next,
    path,
    metricKey,
    linkKey,
    badgeKey,
    subtitleKeys,
  ]);

  if (!level) return null;

  const query = search.trim().toLowerCase();
  const filtered = rows.filter(row =>
    name(row.value).toLowerCase().includes(query),
  );
  const shown = filtered.slice(0, visible);
  const rootLabel = t('All %s', plural(levels[0].label));
  const parent = depth > 0 ? levels[depth - 1] : undefined;
  const showDuration = hasDuration && !next;

  return (
    <Wrapper height={height}>
      <div className="ud-card">
        <div className="ud-header">
          <div>
            <h2 className="ud-title">
              {titlePrefix} {lower(level.label)}
            </h2>
            <nav className="ud-breadcrumb">
              {depth === 0 ? (
                <span className="ud-crumb-current">{rootLabel}</span>
              ) : (
                <button
                  type="button"
                  className="ud-crumb"
                  onClick={() => goTo([])}
                >
                  {rootLabel}
                </button>
              )}
              {path.map((value, i) => (
                <Fragment key={i}>
                  <span className="ud-crumb-sep">›</span>
                  {i === path.length - 1 ? (
                    <span className="ud-crumb-current">{display(value)}</span>
                  ) : (
                    <button
                      type="button"
                      className="ud-crumb"
                      onClick={() => goTo(path.slice(0, i + 1))}
                    >
                      {display(value)}
                    </button>
                  )}
                </Fragment>
              ))}
            </nav>
          </div>

          <div className="ud-tools">
            <span className="ud-hint">
              {next
                ? t('Select a row to drill down')
                : parent &&
                  t('%s for this %s', metricLabel, lower(parent.label))}
            </span>
            <div className="ud-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder={t('Search %s', plural(level.label))}
                aria-label={t('Search %s', plural(level.label))}
                value={search}
                onChange={event => {
                  setSearch(event.target.value);
                  setVisible(PAGE_SIZE);
                }}
              />
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>{level.label}</th>
              <th className="ud-num">{metricLabel}</th>
              <th className="ud-share-col">{t('Share')}</th>
              {showDuration ? (
                <th className="ud-duration">{t('API duration')}</th>
              ) : (
                <th className="ud-chevron-col" aria-label={t('Open')} />
              )}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="ud-empty">
                  {t('No %s found', plural(level.label))}
                </td>
              </tr>
            )}
            {shown.map(row => {
              const drillable = !!next && !isPlaceholder(row.value);
              return (
                <Tooltip
                  key={display(row.value)}
                  title={hint(row.value)}
                  placement="topLeft"
                >
                  <tr
                    className={drillable ? 'ud-clickable' : undefined}
                    onClick={
                      drillable ? () => goTo([...path, row.value]) : undefined
                    }
                  >
                    <td>
                      {next ? (
                        <>
                          <div className="ud-name">{name(row.value)}</div>
                          <div className="ud-sub">
                            {count(row.children.size, next.label)}
                            {depth > 0 && row.links.size === 1 && (
                              <>
                                {' · '}
                                <a
                                  href={[...row.links][0]}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={event => event.stopPropagation()}
                                >
                                  {t('View detail')}
                                </a>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="ud-api">
                          {row.badges.size === 1 && (
                            <span
                              className={`ud-badge ud-badge-${[...row.badges][0].toLowerCase()}`}
                            >
                              {[...row.badges][0]}
                            </span>
                          )}
                          <div>
                            <div className="ud-name">{name(row.value)}</div>
                            {row.subtitles.size === 1 && (
                              <div className="ud-sub ud-sub-mono">
                                {[...row.subtitles][0]}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="ud-num ud-mono">
                      {row.total.toLocaleString()}
                    </td>
                    <td className="ud-share-col">
                      <div className="ud-share">
                        <div className="ud-bar">
                          <div
                            className="ud-bar-fill"
                            style={{ width: `${row.share}%` }}
                          />
                        </div>
                        <span className="ud-mono">{row.share.toFixed(1)}%</span>
                      </div>
                    </td>
                    {showDuration ? (
                      <td className="ud-duration ud-mono">
                        {row.durationRuns
                          ? `${(row.durationTotal / row.durationRuns / 1000).toFixed(2)} s`
                          : '—'}
                      </td>
                    ) : (
                      <td className="ud-chevron-col">{drillable && '›'}</td>
                    )}
                  </tr>
                </Tooltip>
              );
            })}
          </tbody>
        </table>

        <div className="ud-footer">
          <span>{t('Showing %s of %s', shown.length, filtered.length)}</span>
          {shown.length < filtered.length && (
            <span className="ud-more">
              <button
                type="button"
                onClick={() => setVisible(visible + PAGE_SIZE)}
              >
                {t(
                  'Show %s more',
                  Math.min(PAGE_SIZE, filtered.length - shown.length),
                )}
              </button>
              <button type="button" onClick={() => setVisible(filtered.length)}>
                {t('Show all')}
              </button>
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
