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
import { ReactNode, useEffect, useRef } from 'react';
import { t, tn } from '@apache-superset/core/translation';
import { formatResolvedTimeRange, SEPARATOR } from '@superset-ui/core';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Alert } from '@apache-superset/core/components';
import {
  Button,
  Col,
  Flex,
  InputNumber,
  Loading,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from '@superset-ui/core/components';
import { makeUrl } from 'src/utils/navigationUtils';
import {
  allowedUnits,
  completeRule,
  DATASET_SAVE_CHECK_MAX_CHARTS,
  DatasetLimits,
  describeLimit,
  describeRuleValue,
  DraftPolicy,
  EditorLevel,
  effectiveConstraints,
  effectiveRuleLabel,
  FieldErrors,
  NeedsReview,
  neverLonger,
  Policy,
  RULE_NAMES,
  ruleDescriptions,
  RuleField,
  ruleLabels,
  RuleName,
  SaveCheckChart,
  SaveCheckItem,
  SaveCheckResult,
  stricterThan,
  TimeGrain,
} from 'src/utils/timeRangeLimits';
import {
  TimeRangeLimitsFailure,
  TimeRangeLimitsState,
  loadFailureText,
  ruleChanged,
  toDraft,
  unitGoneText,
} from './policyDraft';
import { limitAlertIcon } from './limitAlertIcon';
import { SaveCheck, saveCheckWarns } from './useSaveCheck';

export interface TimeRangeLimitsSectionProps {
  level: EditorLevel;
  global: Policy | null;
  value: DraftPolicy;
  stored: Policy;
  needsReview: NeedsReview[];
  eligibleTimeGrains: TimeGrain[];
  timeGrainLabels?: Record<string, string>;
  datasets?: DatasetLimits[];
  errors: FieldErrors;
  state: TimeRangeLimitsState;
  pending?: boolean;
  failure?: TimeRangeLimitsFailure;
  saveFailed: boolean;
  removing: boolean;
  showApplyNote: boolean;
  onChange: (value: DraftPolicy) => void;
  onRetry: () => void;
  onRetrySave: () => void;
  onRemove?: () => void;
  noTimeColumn?: boolean;
  saveCheck?: SaveCheck;
  dashboardPageId?: string;
}

const levelCopy = (level: EditorLevel) =>
  level === 'dashboard'
    ? {
        scope: t(
          'These limits apply to every time range filter and temporal chart query on this dashboard.',
        ),
        bothApply: (args: { global: string; level: string }) =>
          t(
            "Your admin's limit (%(global)s) and this dashboard's limit (%(level)s) both apply.",
            args,
          ),
        remove: t('Remove dashboard limits'),
        removing: t('Dashboard limits will be removed when you save.'),
        saveFailed: t('Dashboard time range limits could not be saved.'),
      }
    : {
        scope: t(
          'These limits apply to every temporal chart query on this dataset, in Explore and on dashboards.',
        ),
        bothApply: (args: { global: string; level: string }) =>
          t(
            "Your admin's limit (%(global)s) and this dataset's limit (%(level)s) both apply.",
            args,
          ),
        remove: t('Remove dataset limits'),
        removing: t('Dataset limits will be removed when you save.'),
        saveFailed: t('Dataset time range limits could not be saved.'),
      };

const errorId = (rule: RuleName, field: RuleField) =>
  `time-range-limits-${rule}-${field}-error`;

function stricterDatasets(
  datasets: DatasetLimits[],
  global: Policy | null,
  value: Policy,
): string[] {
  const labels = ruleLabels();
  return datasets.flatMap(({ name, policy }) => {
    const parts = RULE_NAMES.flatMap(rule => {
      const limit = policy?.[rule];
      if (!limit) {
        return [];
      }
      const constraints = effectiveConstraints(
        global?.[rule] ?? null,
        value[rule],
      );
      const args = {
        rule: labels[rule],
        limit: describeRuleValue(rule, limit),
      };
      if (constraints.every(item => stricterThan(limit, item) === true)) {
        return [t('%(rule)s %(limit)s', args)];
      }
      if (constraints.some(item => neverLonger(item, limit))) {
        return [];
      }
      return [t('%(rule)s %(limit)s (both limits apply)', args)];
    });
    return parts.length
      ? [
          t('%(dataset)s: %(rules)s', {
            dataset: name,
            rules: parts.join(' · '),
          }),
        ]
      : [];
  });
}

const MAX_LINES = 10;

/** "A, B and C"; past the cap, "A, …, J and 4 more". */
function joinNames(names: string[]): string {
  const parts = names.slice(0, MAX_LINES);
  if (names.length > MAX_LINES) {
    parts.push(
      tn('%(count)s more', '%(count)s more', names.length - MAX_LINES, {
        count: names.length - MAX_LINES,
      }),
    );
  }
  return parts.length < 2
    ? parts.join('')
    : t('%(first)s and %(last)s', {
        first: parts.slice(0, -1).join(', '),
        last: parts[parts.length - 1],
      });
}

const DATE_FORMATS = ['YYYY-MM-DD', 'YYYY-MM-DDTHH:mm:ss'];

const isDate = (value: string) =>
  DATE_FORMATS.some(format => extendedDayjs(value, format, true).isValid());

/**
 * A stored range; a custom one with a date at one end and a date or nothing at
 * the other reads as the picker's actual range.
 */
const rangeLabel = (range: string | null) => {
  if (range === null) {
    return t('No filter');
  }
  const ends = range.split(SEPARATOR);
  return ends.length === 2 &&
    ends.some(isDate) &&
    ends.every(end => end === '' || isDate(end))
    ? formatResolvedTimeRange({ since: ends[0], until: ends[1] })
    : range;
};

/** On a dashboard page the link opens Explore under that dashboard's limits. */
const chartLink = (
  { id, slice_name: name, url }: SaveCheckItem,
  dashboardPageId: string,
) => (
  <Typography.Link
    href={makeUrl(
      dashboardPageId
        ? `/explore/?dashboard_page_id=${dashboardPageId}&slice_id=${id}`
        : url,
    )}
    target="_blank"
  >
    {name}
  </Typography.Link>
);

/** The charts the summary sentence can name: each only too long, or unbounded. */
const spanOnly = (chart: SaveCheckChart) =>
  !chart.time_offset &&
  ((chart.reason_code === 'MAX_SPAN_EXCEEDED' && chart.source !== 'dataset') ||
    chart.reason_code === 'UNBOUNDED_RANGE');

function SaveCheckWarning({
  level,
  global,
  result,
  checkedPolicy,
  dashboardPageId,
}: {
  level: EditorLevel;
  global: Policy | null;
  result: SaveCheckResult;
  checkedPolicy: Policy | null;
  dashboardPageId?: string;
}) {
  const { charts, filters, unchecked } = result;
  const pageId = level === 'dashboard' ? (dashboardPageId ?? '') : '';
  const count = charts.length + filters.length + unchecked.length;
  const span = effectiveConstraints(
    global?.max_span ?? null,
    checkedPolicy?.max_span ?? null,
  );
  const singleSpanSummary =
    level === 'dashboard' &&
    count <= MAX_LINES &&
    !filters.length &&
    !unchecked.length &&
    charts.every(spanOnly) &&
    span.length === 1;

  let message: string;
  if (singleSpanSummary) {
    message = tn(
      '%(charts)s uses its own time range, longer than %(limit)s. Viewers see "Waiting for a valid time range" on it until you change it.',
      '%(charts)s use their own time range, longer than %(limit)s. Viewers see "Waiting for a valid time range" on them until you change it.',
      charts.length,
      {
        charts: joinNames(
          charts.map(chart =>
            t('%(chart)s (%(range)s)', {
              chart: chart.slice_name,
              range: rangeLabel(chart.range),
            }),
          ),
        ),
        limit: describeLimit(span[0]),
      },
    );
  } else if (level === 'dashboard') {
    message = t(
      'These charts use their own time range, which this dashboard\'s limits don\'t allow. Viewers see "Waiting for a valid time range" on them until you change it.',
    );
  } else {
    message = t(
      "These charts on this dataset use their own time range, which these limits don't allow. Their queries stop until you change it.",
    );
  }

  // A placeholder keeps the link movable within the translated sentence.
  const linkToken = '\u0000';
  const linkedLine = (chart: SaveCheckItem, sentence: string): ReactNode => {
    const [before, after] = sentence.split(linkToken);
    return (
      <>
        {before}
        {chartLink(chart, pageId)}
        {after}
      </>
    );
  };
  const chartLine = (chart: SaveCheckChart): ReactNode => {
    const args = {
      chart: linkToken,
      range: rangeLabel(chart.range),
      message: chart.message,
    };
    if (singleSpanSummary || chart.reason_code === 'UNBOUNDED_RANGE') {
      return linkedLine(chart, t('%(chart)s (%(range)s)', args));
    }
    return linkedLine(
      chart,
      chart.time_offset
        ? t('%(chart)s: %(message)s', args)
        : t('%(chart)s (%(range)s): %(message)s', args),
    );
  };

  const lines: { key: string; content: ReactNode }[] = [
    ...filters.map(filter => ({
      key: `filter-${filter.id}`,
      content: filter.no_default
        ? t('Time range filter "%(filter)s" has no default range.', {
            filter: filter.name,
          })
        : t(
            'Time range filter "%(filter)s" defaults to %(range)s: %(message)s',
            {
              filter: filter.name,
              range: rangeLabel(filter.range),
              message: filter.message,
            },
          ),
    })),
    ...charts.map(chart => ({
      key: `chart-${chart.id}-${chart.time_offset ?? ''}`,
      content: chartLine(chart),
    })),
    ...unchecked.map(chart => ({
      key: `unchecked-${chart.id}`,
      content: linkedLine(
        chart,
        t('%(chart)s: Time range limits could not be checked for this chart.', {
          chart: linkToken,
        }),
      ),
    })),
  ];

  return (
    <Alert
      type="warning"
      icon={limitAlertIcon('warning')}
      closable={false}
      showIcon
      message=""
      description={
        <Space direction="vertical">
          <Typography.Text>{message}</Typography.Text>
          {lines.slice(0, MAX_LINES).map(line => (
            <Typography.Text key={line.key}>{line.content}</Typography.Text>
          ))}
          {lines.length > MAX_LINES && (
            <Typography.Text>
              {tn(
                'and %(count)s more',
                'and %(count)s more',
                lines.length - MAX_LINES,
                { count: lines.length - MAX_LINES },
              )}
            </Typography.Text>
          )}
        </Space>
      }
    />
  );
}

export default function TimeRangeLimitsSection({
  level,
  global,
  value,
  stored,
  needsReview,
  eligibleTimeGrains,
  timeGrainLabels,
  datasets,
  errors,
  state,
  pending = false,
  failure,
  saveFailed,
  removing,
  showApplyNote,
  onChange,
  onRetry,
  onRetrySave,
  onRemove,
  noTimeColumn = false,
  saveCheck,
  dashboardPageId,
}: TimeRangeLimitsSectionProps) {
  const regionRef = useRef<HTMLElement>(null);
  const fromRetry = useRef(false);
  const previousState = useRef(state);
  const attempt = failure?.attempt;
  const labels = ruleLabels();
  const descriptions = ruleDescriptions();
  const copy = levelCopy(level);
  const disabled = state !== 'ready' || noTimeColumn;
  const shown = noTimeColumn ? toDraft(stored) : value;
  const edited: Policy = {
    max_span: completeRule(shown.max_span),
    max_look_back: completeRule(shown.max_look_back),
    max_look_forward: completeRule(shown.max_look_forward),
  };

  useEffect(() => {
    if (fromRetry.current && attempt) {
      regionRef.current
        ?.querySelector<HTMLButtonElement>('[role="alert"] button')
        ?.focus();
      fromRetry.current = false;
    }
  }, [attempt]);

  useEffect(() => {
    const loaded =
      previousState.current === 'failed' &&
      (state === 'ready' || state === 'noUnits');
    previousState.current = state;
    if (fromRetry.current && loaded) {
      regionRef.current?.focus();
      fromRetry.current = false;
    }
  }, [state]);

  const retry = () => {
    fromRetry.current = true;
    onRetry();
  };

  const setRule = (rule: RuleName, part: Partial<DraftPolicy[RuleName]>) =>
    onChange({ ...value, [rule]: { ...value[rule], ...part } });

  const fieldError = (rule: RuleName, field: RuleField) => {
    const message = errors[`${rule}.${field}`];
    return message
      ? {
          message,
          inputProps: {
            'aria-invalid': true,
            'aria-describedby': errorId(rule, field),
          },
        }
      : { message: undefined, inputProps: {} };
  };

  const fieldErrorLines = RULE_NAMES.flatMap(rule =>
    (['quantity', 'time_grain'] as const).flatMap(field => {
      const { message } = fieldError(rule, field);
      return message ? [{ rule, field, message }] : [];
    }),
  );

  const levelColumn = level === 'dashboard' ? t('Dashboard') : t('Dataset');
  // The shared Table sets nowrap on every body cell; these two cells wrap so the table fits
  const wrapCell = () => ({ style: { whiteSpace: 'normal' as const } });
  const columns = [
    {
      title: t('Rule'),
      dataIndex: 'rule',
      key: 'rule',
      render: (rule: RuleName) => (
        <Flex vertical>
          <Typography.Text>{labels[rule]}</Typography.Text>
          <Typography.Text type="secondary">
            {descriptions[rule]}
          </Typography.Text>
        </Flex>
      ),
      width: 150,
      onCell: wrapCell,
    },
    {
      title: t('Global'),
      dataIndex: 'rule',
      key: 'global',
      render: (rule: RuleName) => {
        if (state === 'loading') {
          return null;
        }
        const limit = global?.[rule];
        return limit ? describeRuleValue(rule, limit) : t('No limit');
      },
      width: 80,
    },
    {
      title: levelColumn,
      dataIndex: 'rule',
      key: 'level',
      render: (rule: RuleName) => {
        const quantity = fieldError(rule, 'quantity');
        const unit = fieldError(rule, 'time_grain');
        return (
          <Row gutter={[8, 8]}>
            <Col span={24}>
              <InputNumber
                aria-label={t('%(rule)s quantity', { rule: labels[rule] })}
                value={shown[rule].quantity}
                min={rule === 'max_span' ? 1 : 0}
                max={9999}
                precision={0}
                disabled={disabled}
                style={{ width: '100%' }}
                onChange={next =>
                  setRule(rule, {
                    quantity: typeof next === 'number' ? next : null,
                  })
                }
                {...quantity.inputProps}
              />
            </Col>
            <Col span={24}>
              <Select
                ariaLabel={t('%(rule)s unit', { rule: labels[rule] })}
                options={allowedUnits(
                  global?.[rule] ?? null,
                  eligibleTimeGrains,
                  stored[rule]?.time_grain,
                  timeGrainLabels,
                )}
                value={shown[rule].time_grain ?? undefined}
                sortComparator={() => 0}
                allowClear
                getPopupContainer={() => document.body}
                disabled={disabled}
                onChange={(next: string | undefined) =>
                  setRule(rule, { time_grain: next ?? null })
                }
                onClear={() => setRule(rule, { time_grain: null })}
                {...unit.inputProps}
              />
            </Col>
            {rule === 'max_look_back' && (
              <Col span={24}>
                <Typography.Text>{t('ago')}</Typography.Text>
              </Col>
            )}
          </Row>
        );
      },
      width: 128,
    },
    {
      title: t('Effective'),
      dataIndex: 'rule',
      key: 'effective',
      render: (rule: RuleName) =>
        state === 'loading'
          ? null
          : effectiveRuleLabel(rule, global?.[rule] ?? null, edited[rule]),
      width: 110,
      onCell: wrapCell,
    },
  ];

  const staleNotes = RULE_NAMES.flatMap(rule => {
    const globalRule = global?.[rule];
    const storedRule = stored[rule];
    if (
      !globalRule ||
      !storedRule ||
      ruleChanged(shown[rule], storedRule) ||
      !needsReview.some(item => item.rule === rule)
    ) {
      return [];
    }
    const args = {
      global: describeLimit(globalRule),
      level: describeLimit(storedRule),
    };
    return [
      {
        rule,
        text: neverLonger(globalRule, storedRule)
          ? t(
              "Your admin's limit (%(global)s) is stricter than %(level)s, so %(global)s applies.",
              args,
            )
          : copy.bothApply(args),
      },
    ];
  });

  const datasetLines =
    state === 'ready' && datasets
      ? stricterDatasets(datasets, global, edited)
      : [];

  const showRows = state !== 'failed';
  const check =
    saveCheck && saveCheck.state !== 'idle' && !Object.keys(errors).length
      ? saveCheck
      : undefined;
  const checkResult = check?.result;
  const warned = saveCheckWarns(saveCheck, errors);
  const unlimited =
    level === 'dashboard' && checkResult ? checkResult.unlimited : [];
  const canRemove = onRemove !== undefined && failure?.source === level;

  return (
    <section
      ref={regionRef}
      aria-label={t('Time range limits')}
      aria-busy={pending || undefined}
      tabIndex={-1}
    >
      <Space direction="vertical">
        <Typography.Text type="secondary">{copy.scope}</Typography.Text>
        {state === 'loading' && <Loading position="inline-centered" />}
        {noTimeColumn && showRows && (
          <Typography.Text type="secondary">
            {t(
              "This dataset has no time column, so time range limits don't apply.",
            )}
          </Typography.Text>
        )}
        {state === 'failed' && failure && removing && (
          <Typography.Text>{copy.removing}</Typography.Text>
        )}
        {state === 'failed' && failure && !removing && (
          <Alert
            key={failure.attempt}
            type="error"
            icon={limitAlertIcon('error')}
            closable={false}
            message={loadFailureText()}
            description={
              failure.unitValue ? unitGoneText(failure.unitValue) : undefined
            }
            action={
              <Space direction="vertical">
                <Button buttonSize="small" loading={pending} onClick={retry}>
                  {t('Retry')}
                </Button>
                {canRemove && (
                  <Button buttonSize="small" onClick={onRemove}>
                    {copy.remove}
                  </Button>
                )}
              </Space>
            }
          />
        )}
        {state === 'noUnits' && (
          <Typography.Text type="secondary">
            {t('No eligible time grains configured')}
          </Typography.Text>
        )}
        {showRows && (
          <Table
            columns={columns}
            data={RULE_NAMES.map(rule => ({ key: rule, rule }))}
            pagination={false}
            tableLayout="auto"
          />
        )}
        {showRows && (
          <div aria-live="polite">
            <Space direction="vertical">
              {fieldErrorLines.map(({ rule, field, message }) => (
                <Typography.Text
                  key={errorId(rule, field)}
                  type="danger"
                  id={errorId(rule, field)}
                >
                  <Typography.Text strong>{labels[rule]}</Typography.Text>{' '}
                  {message}
                </Typography.Text>
              ))}
            </Space>
          </div>
        )}
        {staleNotes.map(note => (
          <Alert
            key={note.rule}
            type="info"
            icon={limitAlertIcon('info')}
            closable={false}
            message={note.text}
          />
        ))}
        {datasetLines.length > 0 && (
          <Space direction="vertical">
            <Typography.Text>
              {t('Datasets with stricter limits')}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t("Charts on these datasets are held to the dataset's limit.")}
            </Typography.Text>
            {datasetLines.map(line => (
              <Typography.Text key={line}>{line}</Typography.Text>
            ))}
          </Space>
        )}
        {check && (
          <div aria-busy={check.state === 'checking' || undefined}>
            <Space direction="vertical">
              {checkResult && warned && (
                <SaveCheckWarning
                  level={level}
                  global={global}
                  result={checkResult}
                  checkedPolicy={check.checkedPolicy}
                  dashboardPageId={dashboardPageId}
                />
              )}
              <div aria-live="polite">
                {unlimited.length > 0 && (
                  <Typography.Text type="secondary">
                    {tn(
                      "%(charts)s can't be limited: its dataset has no time column.",
                      "%(charts)s can't be limited: their datasets have no time column.",
                      unlimited.length,
                      {
                        charts: joinNames(
                          unlimited.map(chart => chart.slice_name),
                        ),
                      },
                    )}
                  </Typography.Text>
                )}
                {checkResult?.truncated && (
                  <Typography.Text type="secondary">
                    {tn(
                      'Only the first %(count)s chart was checked.',
                      'Only the first %(count)s charts were checked.',
                      DATASET_SAVE_CHECK_MAX_CHARTS,
                      {
                        count: DATASET_SAVE_CHECK_MAX_CHARTS,
                      },
                    )}
                  </Typography.Text>
                )}
                {check.state === 'failed' && (
                  <Typography.Text type="secondary">
                    {t('Charts could not be checked against these limits.')}
                  </Typography.Text>
                )}
              </div>
            </Space>
          </div>
        )}
        {saveFailed && (
          <Alert
            type="error"
            icon={limitAlertIcon('error')}
            closable={false}
            message={copy.saveFailed}
            action={
              <Button buttonSize="small" onClick={onRetrySave}>
                {t('Retry')}
              </Button>
            }
          />
        )}
        {showApplyNote && !removing && (
          <Typography.Text type="secondary">
            {t('Saved when you apply, separately from the dashboard.')}
          </Typography.Text>
        )}
      </Space>
    </section>
  );
}
