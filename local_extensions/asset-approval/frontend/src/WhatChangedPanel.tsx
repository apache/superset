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
import React, { useState } from 'react';
import { Button, Icons, Input, styled, t } from './host';
import { ago, changeCount } from './display';
import { displayName, STATUS_LABEL } from './types';
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

const Tag = styled.span`
  ${({ theme }) => `
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
  `}
`;

const Note = styled.div`
  ${({ theme }) => `
    white-space: pre-wrap;
    color: ${theme.colorText};
  `}
`;

const FieldBlock = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 2}px 0;
    border-bottom: 1px dashed ${theme.colorSplit};
    &:last-of-type { border-bottom: none; }
  `}
`;

const FieldName = styled.div`
  ${({ theme }) => `
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
    margin-bottom: ${theme.sizeUnit}px;
  `}
`;

const Before = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    text-decoration: line-through;
    word-break: break-word;
  `}
`;

const After = styled.div`
  ${({ theme }) => `
    color: ${theme.colorSuccessText};
    word-break: break-word;
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
 * What a reviewer calls these, rather than what the column is called.
 *
 * `params` and `json_metadata` are storage names; a reviewer deciding
 * whether to publish a change should not have to know them (129075).
 */
const FIELD_LABELS: Record<string, string> = {
  slice_name: t('Title'),
  dashboard_title: t('Title'),
  table_name: t('Name'),
  description: t('Description'),
  params: t('Chart configuration'),
  query_context: t('Query'),
  json_metadata: t('Dashboard settings'),
  position_json: t('Layout'),
  css: t('Stylesheet'),
  published: t('Published'),
  cache_timeout: t('Cache timeout'),
  owners: t('Owners'),
  editors: t('Editors'),
  sql: t('SQL'),
};

const fieldLabel = (field: string): string => FIELD_LABELS[field] ?? field;

/** "Title, metrics and 2 more" -- a list a person can read at a glance. */
function summarise(keys: string[]): string {
  const named = keys.slice(0, 3).map(fieldLabel);
  const rest = keys.length - named.length;
  const list = named.join(', ');
  return rest > 0 ? t('%s and %s more', list, rest) : list;
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
          {t('by %s · %s', displayName(changeRequest.author), ago(changeRequest.changed_on))}
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
          <DatasetReview detail={changeRequest.dataset_detail!} />
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
          <Muted>
            {t('This asset would be removed once approved.')}
          </Muted>
        ) : fields.length === 0 ? (
          // Everything submitted matched what was already stored. Saying
          // "no fields recorded" would imply we lost the detail; the truth
          // is the save carried nothing new.
          <Muted>{t('Nothing differs from the live version.')}</Muted>
        ) : (
          (changeRequest.changes ?? []).map(change => (
            <FieldBlock key={change.field}>
              <FieldName>{fieldLabel(change.field)}</FieldName>
              {change.opaque ? (
                change.layout ? (
                  <Muted>
                    {t(
                      '%s added, %s removed, %s moved',
                      change.layout.added,
                      change.layout.removed,
                      change.layout.changed,
                    )}
                  </Muted>
                ) : change.keys?.length ? (
                  <Muted>{summarise(change.keys)}</Muted>
                ) : (
                  <Tag>{t('Changed')}</Tag>
                )
              ) : (
                <>
                  <Before>{String(change.before ?? '—')}</Before>
                  <After>{String(change.after ?? '—')}</After>
                </>
              )}
            </FieldBlock>
          ))
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
            disabled={review.busy}
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
