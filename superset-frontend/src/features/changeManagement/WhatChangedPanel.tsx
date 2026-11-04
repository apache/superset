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
import { styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import { Button } from '@superset-ui/core/components';
import { Input } from '@superset-ui/core/components/Input';
import { useMemo, useState } from 'react';
import getControlsForVizType from 'src/utils/getControlsForVizType';
import { ago, changeCount, reviewBlocker } from './display';
import { displayName, STATUS_LABEL } from './types';
import ChangeList, { BlockedNotice } from './ChangeList';
import DatasetReview from './DatasetReview';
import type { ChangeRequest } from './types';

/**
 * 320px, matching the Version history panel it sits beside -- the two are
 * the same kind of thing (a record of what happened to this asset) and
 * should not be two different widths on the same screen.
 */
const Panel = styled.div`
  ${({ theme }) => `
    width: 320px;
    flex: 0 0 320px;
    height: 100%;
    overflow-y: auto;
    border-left: 1px solid ${theme.colorSplit};
    background: ${theme.colorBgContainer};
    display: flex;
    flex-direction: column;
  `}
`;

/** The list scrolls; the decision does not scroll away with it. */
const Body = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const Footer = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colorSplit};
    background: ${theme.colorBgContainer};
  `}
`;

const Header = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorSplit};
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Section = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

const SectionTitle = styled.div`
  ${({ theme }) => `
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const Note = styled.div`
  ${({ theme }) => `
    white-space: pre-wrap;
    color: ${theme.colorText};
  `}
`;

const AddNote = styled(Input.TextArea)`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 2}px;
  `}
`;

const Muted = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
  `}
`;

/**
 * The chart's own control labels, for the keys inside `params`.
 *
 * `FIELD_LABELS` in `ChangeList` covers storage columns. The keys *inside* `params`
 * are Explore control names, and they had no mapping at all, so the panel
 * read "Chart configuration: adhoc_filters, axisTicks,
 * color_by_primary_axis and 75 more" -- internal names a reviewer deciding
 * whether to publish should not have to know (sc-129075).
 *
 * The labels come from the chart's own control panel, which is where
 * Explore gets them, so they match what the author saw when they made the
 * change. `AlteredSliceTag` resolves Superset's own "this chart differs
 * from its saved version" diff the same way, down to the label-or-raw-key
 * fallback.
 *
 * A key that is not a control -- `viz_type`, `datasource`, `slice_id`,
 * `url_params` and friends -- keeps its raw name, as it does there.
 */
function controlLabels(changeRequest: ChangeRequest): Record<string, string> {
  // A chart's params, and nothing else. Keying only on the field name left
  // this reachable by anything that happens to carry a `params` string with
  // a `viz_type` in it, which would relabel keys that are not Explore
  // controls at all.
  if (changeRequest.asset_type !== 'chart') {
    return {};
  }
  const params = changeRequest.proposed?.params;
  if (typeof params !== 'string') {
    return {};
  }
  try {
    const vizType = (JSON.parse(params) ?? {}).viz_type;
    if (typeof vizType !== 'string' || !vizType) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(getControlsForVizType(vizType) ?? {}).flatMap(
        ([name, config]) =>
          // A label can be a node or a function for a dynamic control, and
          // only a plain string is safe to drop into a sentence.
          typeof config?.label === 'string' ? [[name, config.label]] : [],
      ),
    );
    // A viz type the registry does not know, or params that will not parse,
    // leaves every key as it was rather than failing the panel.
  } catch {
    return {};
  }
}

export interface WhatChangedPanelProps {
  changeRequest: ChangeRequest;
  onClose: () => void;
  /** Present only for someone who may decide this one. */
  review?: {
    busy: boolean;
    onApprove: (note: string) => void;
    onRequestChanges: () => void;
  };
}

/**
 * Who asked, why, and what they touched.
 *
 * Deliberately a list of *fields*, not a rendered diff. Visa review datasets
 * as definitions rather than by rendering charts against the draft
 * (Visa Q11), and the same principle keeps this honest for dashboards: it
 * names what moved and lets the reviewer look at it in place with Show
 * changes, instead of inventing a visual diff nobody asked to trust.
 */
export default function WhatChangedPanel({
  changeRequest,
  onClose,
  review,
}: WhatChangedPanelProps) {
  // The approver's own words, carried into the approval so the version
  // history records why it was let through, not only that it was.
  const [extraNote, setExtraNote] = useState('');
  const fields = changeRequest.changes ?? [];
  const controls = useMemo(() => controlLabels(changeRequest), [changeRequest]);
  // Why Approve is withheld, if it is. Asked of the request and not of the
  // list below, so an empty list can never read as "nothing changed" beside
  // an enabled button.
  const blocker = reviewBlocker(changeRequest);
  const keywords = fields.filter(change => change.keyword);
  const isDatasetDefinition =
    !!changeRequest.dataset_detail && changeRequest.operation !== 'delete';

  return (
    <Panel data-test="what-changed-panel">
      <Header>
        <span>
          {changeRequest.status === 'changes_requested'
            ? t('Changes requested')
            : t('Review changes')}
        </span>
        <Button
          buttonStyle="link"
          buttonSize="small"
          onClick={onClose}
          aria-label={t('Close')}
        >
          <Icons.CloseOutlined iconSize="l" />
        </Button>
      </Header>

      <Body>
        <Section>
          <SectionTitle>{t('Status')}</SectionTitle>
          <div>{STATUS_LABEL[changeRequest.status]}</div>
          <Muted>
            {t(
              'by %s · %s',
              displayName(changeRequest.author),
              ago(changeRequest.changed_on),
            )}
          </Muted>
        </Section>

        {changeRequest.note || review ? (
          <Section>
            <SectionTitle>{t('Note')}</SectionTitle>
            {changeRequest.note ? <Note>{changeRequest.note}</Note> : null}
            {review ? (
              <AddNote
                value={extraNote}
                onChange={e => setExtraNote(e.target.value)}
                placeholder={t('Add to the note (optional)')}
                rows={2}
                data-test="approver-note"
              />
            ) : null}
          </Section>
        ) : null}

        {changeRequest.review_note ? (
          <Section>
            <SectionTitle>{t('What needs to change')}</SectionTitle>
            <Note>{changeRequest.review_note}</Note>
            <Muted>{t('— %s', displayName(changeRequest.reviewer))}</Muted>
          </Section>
        ) : null}

        {/* A dataset's definition diff *is* its list of changes. Rendering it
          in its own section and then a second "What changed" section below
          produced a panel that listed a renamed metric and then said
          "0 changes · Nothing differs from the live version" underneath
          it: two sections counting from two different fields. One section
          now, counted once. */}
        {isDatasetDefinition ? (
          <Section>
            <SectionTitle>
              {`${t('What changed')} · ${changeCount(changeRequest)}`}
            </SectionTitle>
            {blocker ? <BlockedNotice reason={blocker} /> : null}
            <DatasetReview detail={changeRequest.dataset_detail!} />
            {blocker ? (
              <ChangeList changes={fields.filter(change => change.unreadable)} />
            ) : null}
            {keywords.length ? <ChangeList changes={keywords} /> : null}
          </Section>
        ) : (
          <Section>
            <SectionTitle>
              {changeRequest.operation === 'delete'
                ? t('What happens')
                : `${t('What changed')} · ${changeCount(changeRequest)}`}
            </SectionTitle>

            {changeRequest.operation === 'delete' ? (
              // A delete has no fields. Saying "0 changes" would describe the
              // most consequential request in the system as nothing happening.
              <>
                <Muted>{t('This asset would be removed once approved.')}</Muted>
                {keywords.length ? <ChangeList changes={keywords} /> : null}
              </>
            ) : blocker ? (
              <>
                <BlockedNotice reason={blocker} />
                <ChangeList changes={fields} />
              </>
            ) : fields.length === 0 ? (
              // Everything submitted matched what was already stored. Saying
              // "no fields recorded" would imply we lost the detail; the truth
              // is the save carried nothing new.
              <Muted>{t('Nothing differs from the live version.')}</Muted>
            ) : (
              <ChangeList changes={fields} controls={controls} />
            )}
          </Section>
        )}
      </Body>

      {review ? (
        <Footer>
          <Button
            buttonStyle="danger"
            buttonSize="small"
            disabled={review.busy}
            onClick={review.onRequestChanges}
            data-test="panel-request-changes"
          >
            {t('Request changes')}
          </Button>
          <Button
            buttonStyle="primary"
            buttonSize="small"
            disabled={review.busy || !!blocker}
            onClick={() => review.onApprove(extraNote)}
            data-test="panel-approve"
          >
            {t('Approve')}
          </Button>
        </Footer>
      ) : null}
    </Panel>
  );
}
