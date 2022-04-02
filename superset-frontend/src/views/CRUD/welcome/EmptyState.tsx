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
import React from 'react';
import Button from 'src/components/Button';
import { Empty } from 'src/components';
import { t, styled } from '@superset-ui/core';
import { WelcomeTable } from './types';

const welcomeTableLabels: Record<WelcomeTable, string> = {
  [WelcomeTable.Charts]: t('charts'),
  [WelcomeTable.Dashboards]: t('dashboards'),
  [WelcomeTable.Recents]: t('recents'),
  [WelcomeTable.SavedQueries]: t('saved queries'),
};

interface EmptyStateProps {
  tableName: WelcomeTable;
  tab?: string;
}
const EmptyContainer = styled.div`
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
`;
const ButtonContainer = styled.div`
  Button {
    svg {
      color: ${({ theme }) => theme.colors.grayscale.light5};
    }
  }
`;

type Redirects = Record<
  WelcomeTable.Charts | WelcomeTable.Dashboards | WelcomeTable.SavedQueries,
  string
>;

export default function EmptyState({ tableName, tab }: EmptyStateProps) {
  const mineRedirects: Redirects = {
    [WelcomeTable.Charts]: '/chart/add',
    [WelcomeTable.Dashboards]: '/dashboard/new',
    [WelcomeTable.SavedQueries]: '/superset/sqllab?new=true',
  };
  const favRedirects: Redirects = {
    [WelcomeTable.Charts]: '/chart/list',
    [WelcomeTable.Dashboards]: '/dashboard/list/',
    [WelcomeTable.SavedQueries]: '/savedqueryview/list/',
  };
  const tableIcon: Record<WelcomeTable, string> = {
    [WelcomeTable.Charts]: 'empty-charts.svg',
    [WelcomeTable.Dashboards]: 'empty-dashboard.svg',
    [WelcomeTable.Recents]: 'union.svg',
    [WelcomeTable.SavedQueries]: 'empty-queries.svg',
  };
  const mine = (
    <span>
      {t('No %(tableName)s yet', { tableName: welcomeTableLabels[tableName] })}
    </span>
  );
  const recent = (
    <span className="no-recents">
      {(() => {
        if (tab === 'Viewed') {
          return t(
            `Recently viewed charts, dashboards, and saved queries will appear here`,
          );
        }
        if (tab === 'Created') {
          return t(
            'Recently created charts, dashboards, and saved queries will appear here',
          );
        }
        if (tab === 'Examples') {
          return t('Example %(tableName)s will appear here', {
            tableName: tableName.toLowerCase(),
          });
        }
        if (tab === 'Edited') {
          return t(
            `Recently edited charts, dashboards, and saved queries will appear here`,
          );
        }
        return null;
      })()}
    </span>
  );
  // Mine and Recent Activity(all tabs) tab empty state
  if (tab === 'Mine' || tableName === 'RECENTS' || tab === 'Examples') {
    return (
      <EmptyContainer>
        <Empty
          image={`/static/assets/images/${tableIcon[tableName]}`}
          description={
            tableName === 'RECENTS' || tab === 'Examples' ? recent : mine
          }
        >
          {tableName !== 'RECENTS' && (
            <ButtonContainer>
              <Button
                buttonStyle="primary"
                onClick={() => {
                  window.location.href = mineRedirects[tableName];
                }}
              >
                <i className="fa fa-plus" />
                {tableName === 'SAVED_QUERIES'
                  ? t('SQL query')
                  : t(`${tableName
                      .split('')
                      .slice(0, tableName.length - 1)
                      .join('')}
                    `)}
              </Button>
            </ButtonContainer>
          )}
        </Empty>
      </EmptyContainer>
    );
  }
  // Favorite tab empty state
  return (
    <EmptyContainer>
      <Empty
        image="/static/assets/images/star-circle.svg"
        description={
          <span className="no-favorites">
            {t("You don't have any favorites yet!")}
          </span>
        }
      >
        <Button
          buttonStyle="primary"
          onClick={() => {
            window.location.href = favRedirects[tableName];
          }}
        >
          {t('See all %(tableName)s', {
            tableName:
              tableName === 'SAVED_QUERIES'
                ? t('SQL Lab queries')
                : welcomeTableLabels[tableName],
          })}
        </Button>
      </Empty>
    </EmptyContainer>
  );
}
