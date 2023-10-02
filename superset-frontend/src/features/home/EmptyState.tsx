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
import { TableTab } from 'src/views/CRUD/types';
import { styled, t } from '@superset-ui/core';
import { WelcomeTable } from './types';

const welcomeTableLabels: Record<WelcomeTable, string> = {
  [WelcomeTable.Charts]: t('charts'),
  [WelcomeTable.Dashboards]: t('dashboards'),
  [WelcomeTable.Recents]: t('recents'),
  [WelcomeTable.SavedQueries]: t('saved queries'),
};

const welcomeTableEmpty: Record<WelcomeTable, string> = {
  [WelcomeTable.Charts]: t('No charts yet'),
  [WelcomeTable.Dashboards]: t('No dashboards yet'),
  [WelcomeTable.Recents]: t('No recents yet'),
  [WelcomeTable.SavedQueries]: t('No saved queries yet'),
};

const welcomeTableWillAppear: Record<WelcomeTable, (other: string) => string> =
  {
    [WelcomeTable.Charts]: (other: string) =>
      t('%(other)s charts will appear here', { other }),
    [WelcomeTable.Dashboards]: (other: string) =>
      t('%(other)s dashboards will appear here', { other }),
    [WelcomeTable.Recents]: (other: string) =>
      t('%(other)s recents will appear here', { other }),
    [WelcomeTable.SavedQueries]: (other: string) =>
      t('%(other)s saved queries will appear here', { other }),
  };

export interface EmptyStateProps {
  tableName: WelcomeTable;
  tab?: string;
  otherTabTitle?: string;
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

export default function EmptyState({
  tableName,
  tab,
  otherTabTitle,
}: EmptyStateProps) {
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
  const mine = <span>{welcomeTableEmpty[tableName]}</span>;
  const recent = (
    <span className="no-recents">
      {(() => {
        if (tab === TableTab.Viewed) {
          return t(
            `Recently viewed charts, dashboards, and saved queries will appear here`,
          );
        }
        if (tab === TableTab.Created) {
          return t(
            'Recently created charts, dashboards, and saved queries will appear here',
          );
        }
        if (tab === TableTab.Other) {
          const other = otherTabTitle || t('Other');
          return welcomeTableWillAppear[tableName](other);
        }
        if (tab === TableTab.Edited) {
          return t(
            `Recently edited charts, dashboards, and saved queries will appear here`,
          );
        }
        return null;
      })()}
    </span>
  );

  // Mine and Recent Activity(all tabs) tab empty state
  if (
    tab === TableTab.Mine ||
    tableName === WelcomeTable.Recents ||
    tab === TableTab.Other
  ) {
    return (
      <EmptyContainer>
        <Empty
          image={`/static/assets/images/${tableIcon[tableName]}`}
          description={
            tableName === WelcomeTable.Recents || tab === TableTab.Other
              ? recent
              : mine
          }
        >
          {tableName !== WelcomeTable.Recents && (
            <ButtonContainer>
              <Button
                buttonStyle="primary"
                onClick={() => {
                  window.location.href = mineRedirects[tableName];
                }}
              >
                <i className="fa fa-plus" />
                {tableName === WelcomeTable.SavedQueries
                  ? t('SQL query')
                  : tableName
                      .split('')
                      .slice(0, tableName.length - 1)
                      .join('')}
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
              tableName === WelcomeTable.SavedQueries
                ? t('SQL Lab queries')
                : welcomeTableLabels[tableName],
          })}
        </Button>
      </Empty>
    </EmptyContainer>
  );
}
