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
import { styled } from '@superset-ui/core';
import Icon from 'src/components/Icon';
import { IconContainer } from '../utils';

interface EmptyStateProps {
  tableName: string;
  tab?: string;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  img {
    width: 114px;
    display: block;
    margin: 0 auto;
  }
  div:nth-child(2) {
    text-align: center;
    margin-top: 15px;
    color: ${({ theme }) => theme.colors.grayscale.dark1};
    font-weight: 400;
  }
  button {
    margin: 0 auto;
    padding: 6px 27px;
    margin-top: 10px;
    svg {
      color: white;
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
    RECENTS: 'union.png',
    DASHBOARDS: 'empty-dashboard.png',
    CHARTS: 'empty-charts.png',
    SAVED_QUERIES: 'empty-queries.png',
  };
  const mine = (
    <div>
      <div>{`No ${
        tableName === 'SAVED_QUERIES'
          ? 'saved queries'
          : tableName.toLowerCase()
      } yet`}</div>
      <Button
        buttonStyle="primary"
        onClick={() => {
          window.location = mineRedirects[tableName];
        }}
      >
        <IconContainer>
          <Icon name="plus-small" />{' '}
          {tableName === 'SAVED_QUERIES'
            ? 'SQL QUERY'
            : tableName
                .split('')
                .slice(0, tableName.length - 1)
                .join('')}{' '}
        </IconContainer>
      </Button>
    </div>
  );
  const span = (
    <div className="no-recents">
      Recently {tab?.toLowerCase()} charts, dashboards, and saved queries will
      appear here
    </div>
  );

  if (tab === 'Mine' || tableName === 'RECENTS') {
    return (
      <Container>
        <img
          src={`/static/assets/images/${tableIcon[tableName]}`}
          alt={`${tableName}`}
        />
        {tableName === 'RECENTS' ? span : mine}
      </Container>
    );
  }

  return (
    <Container>
      <img src="/static/assets/images/star-circle.png" alt="star.png" />
      <div>
        <div className="no-favorites">You don't have any favorites yet!</div>
        <Button
          buttonStyle="primary"
          onClick={() => {
            window.location = favRedirects[tableName];
          }}
        >
          SEE ALL{' '}
          {tableName === 'SAVED_QUERIES' ? 'SQL LAB QUERIES' : tableName}
        </Button>
      </div>
    </Container>
  );
}
