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
import React, { useEffect, useState } from 'react';
import { Switch, styled, t } from './host';
import { http } from '@apache-superset/core';

const Page = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 6}px;
  `}
`;

const Title = styled.h1`
  ${({ theme }) => `
    font-size: ${theme.fontSizeXL}px;
    margin-bottom: ${theme.sizeUnit * 5}px;
  `}
`;

const Card = styled.div`
  ${({ theme }) => `
    background: ${theme.colorBgContainer};
    border: 1px solid ${theme.colorSplit};
    border-radius: ${theme.borderRadius}px;
    padding: ${theme.sizeUnit * 6}px;
  `}
`;

const Toggle = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Hint = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    margin: ${theme.sizeUnit}px 0 0 ${theme.sizeUnit * 12}px;
    padding-bottom: ${theme.sizeUnit * 5}px;
    border-bottom: 1px solid ${theme.colorSplit};
  `}
`;

const Grid = styled.dl`
  ${({ theme }) => `
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${theme.sizeUnit * 6}px;
    margin: ${theme.sizeUnit * 5}px 0 0 0;
    dt {
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
      margin-bottom: ${theme.sizeUnit}px;
    }
    dd { margin: 0; }
  `}
`;

/**
 * What the instance flag does, stated once, read-only (SOW 5.7, mock S1).
 *
 * There is no settings UI in V1 because the flag is process-static: it is
 * read at start-up and changing it needs a restart, so a control here
 * would be a switch that silently does nothing. An administrator still
 * needs somewhere to confirm what is on and what it implies -- "no admin
 * bypass" is the line they will be asked about -- so the page states the
 * behaviour and says where the switch actually lives.
 */
export default function ChangeReviewSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    http
      .get<{ result?: { enabled?: boolean } }>({
        endpoint: '/api/v1/change_request/enabled',
      })
      .then(({ json }) => setEnabled(!!json.result?.enabled))
      // The page describes configuration, not live state; if the probe
      // fails it still has something true to say.
      .catch(() => setEnabled(null));
  }, []);

  return (
    <Page data-test="change-review-settings">
      <Title>{t('Change review')}</Title>
      <Card>
        <Toggle>
          <Switch checked={!!enabled} disabled size="small" />
          {t('Require review before changes go live')}
        </Toggle>
        <Hint>
          {t('Set in the instance configuration. Changing it needs a restart.')}
        </Hint>

        <Grid>
          <div>
            <dt>{t('Applies to')}</dt>
            <dd>{t('All dashboards, charts and datasets')}</dd>
          </div>
          <div>
            <dt>{t('Who can approve')}</dt>
            <dd>
              {t('Other editors with the approval permission, never the author')}
            </dd>
          </div>
          <div>
            <dt>{t('When no one else can approve')}</dt>
            <dd>{t('Publishing is blocked until another editor is added')}</dd>
          </div>
          <div>
            <dt>{t('Admin bypass')}</dt>
            <dd>{t('Not available')}</dd>
          </div>
        </Grid>
      </Card>
    </Page>
  );
}
