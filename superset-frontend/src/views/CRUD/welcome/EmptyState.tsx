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
import { Empty } from 'src/common/components';
import { t, styled } from '@superset-ui/core';
import Icon from 'src/components/Icon';
import { IconContainer } from '../utils';

interface EmptyStateProps {
  tableName: string;
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

export default function EmptyState({ tableName, tab }: EmptyStateProps) {
  const mineRedirects = {
    DASHBOARDS: '/dashboard/new',
    CHARTS: '/chart/add',
    SAVED_QUERIES: '/superset/sqllab',
  };
  const favRedirects = {
    DASHBOARDS: '/dashboard/list/',
    CHARTS: '/chart/list',
    SAVED_QUERIES: '/savedqueryview/list/',
  };
  const tableIcon = {
    RECENTS: 'union.svg',
    DASHBOARDS: 'empty-dashboard.svg',
    CHARTS: 'empty-charts.svg',
    SAVED_QUERIES: 'empty-queries.svg',
  };
  const mine = (
    <div>{`No ${
      tableName === 'SAVED_QUERIES'
        ? t('saved queries')
        : t(`${tableName.toLowerCase()}`)
    } yet`}</div>
  );
  const recent = (
    <div className="no-recents">
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
          return t(
            `Recent example charts, dashboards, and saved queries will appear here`,
          );
        }
        if (tab === 'Edited') {
          return t(
            `Recently edited charts, dashboards, and saved queries will appear here`,
          );
        }
        return null;
      })()}
    </div>
  );
  // Mine and Recent Activity(all tabs) tab empty state
  if (tab === 'Mine' || tableName === 'RECENTS') {
    return (
      <EmptyContainer>
        <Empty
          image={`/static/assets/images/${tableIcon[tableName]}`}
          description={tableName === 'RECENTS' ? recent : mine}
        >
          {tableName !== 'RECENTS' && (
            <ButtonContainer>
              <Button
                buttonStyle="primary"
                onClick={() => {
                  window.location = mineRedirects[tableName];
                }}
              >
                <IconContainer>
                  <Icon name="plus-small" />{' '}
                  {tableName === 'SAVED_QUERIES'
                    ? t('SQL QUERY')
                    : t(`${tableName
                        .split('')
                        .slice(0, tableName.length - 1)
                        .join('')}
                    `)}
                </IconContainer>
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
          <div className="no-favorites">
            {t("You don't have any favorites yet!")}
          </div>
        }
      >
        <Button
          buttonStyle="primary"
          onClick={() => {
            window.location = favRedirects[tableName];
          }}
        >
          SEE ALL{' '}
          {tableName === 'SAVED_QUERIES'
            ? t('SQL LAB QUERIES')
            : t(`${tableName}`)}
        </Button>
      </Empty>
    </EmptyContainer>
  );
}
