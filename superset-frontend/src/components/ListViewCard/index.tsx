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
import { styled } from '@superset-ui/core';
import Icon from 'src/components/Icon';
import { Card, Skeleton, ThinSkeleton } from 'src/common/components';
import ImageLoader, { BackgroundPosition } from './ImageLoader';

const MenuIcon = styled(Icon)`
  width: ${({ theme }) => theme.gridUnit * 4}px;
  height: ${({ theme }) => theme.gridUnit * 4}px;
  position: relative;
  top: ${({ theme }) => theme.gridUnit / 2}px;
`;

const ActionsWrapper = styled.div`
  width: 64px;
  display: flex;
  justify-content: space-between;
`;

const StyledCard = styled(Card)`
  border: 1px solid #d9dbe4;

  .ant-card-body {
    padding: ${({ theme }) => theme.gridUnit * 4}px
      ${({ theme }) => theme.gridUnit * 2}px;
  }
  .ant-card-meta-detail > div:not(:last-child) {
    margin-bottom: 0;
  }
  .gradient-container {
    position: relative;
    height: 100%;
  }
  &:hover {
    box-shadow: 8px 8px 28px 0px rgba(0, 0, 0, 0.24);
    transition: box-shadow ${({ theme }) => theme.transitionTiming}s ease-in-out;

    .gradient-container:after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      display: inline-block;
      background: linear-gradient(
        180deg,
        rgba(0, 0, 0, 0) 47.83%,
        rgba(0, 0, 0, 0.219135) 79.64%,
        rgba(0, 0, 0, 0.5) 100%
      );

      transition: background ${({ theme }) => theme.transitionTiming}s
        ease-in-out;
    }

    .cover-footer {
      transform: translateY(0);
    }
  }
`;

const Cover = styled.div`
  height: 264px;
  overflow: hidden;

  .cover-footer {
    transform: translateY(${({ theme }) => theme.gridUnit * 9}px);
    transition: ${({ theme }) => theme.transitionTiming}s ease-out;
  }
`;

const TitleContainer = styled.div`
  display: flex;
  justify-content: flex-start;
  flex-direction: row;

  .card-actions {
    margin-left: auto;
    align-self: flex-end;
    padding-left: ${({ theme }) => theme.gridUnit * 8}px;
  }
`;

const TitleLink = styled.a`
  color: ${({ theme }) => theme.colors.grayscale.dark1} !important;
  overflow: hidden;
  text-overflow: ellipsis;

  & + .title-right {
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
`;

const CoverFooter = styled.div`
  display: flex;
  flex-wrap: nowrap;
  position: relative;
  top: -${({ theme }) => theme.gridUnit * 9}px;
  padding: 0 8px;
`;

const CoverFooterLeft = styled.div`
  flex: 1;
  overflow: hidden;
`;

const CoverFooterRight = styled.div`
  align-self: flex-end;
  margin-left: auto;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const SkeletonTitle = styled(Skeleton.Input)`
  width: ${({ theme }) => Math.trunc(theme.gridUnit * 62.5)}px;
`;

const SkeletonActions = styled(Skeleton.Button)`
  width: ${({ theme }) => theme.gridUnit * 10}px;
`;

const paragraphConfig = { rows: 1, width: 150 };
interface CardProps {
  title: React.ReactNode;
  url?: string;
  imgURL: string;
  imgFallbackURL: string;
  imgPosition?: BackgroundPosition;
  description: string;
  loading: boolean;
  titleRight?: React.ReactNode;
  coverLeft?: React.ReactNode;
  coverRight?: React.ReactNode;
  actions: React.ReactNode;
}

function ListViewCard({
  title,
  url,
  titleRight,
  imgURL,
  imgFallbackURL,
  description,
  coverLeft,
  coverRight,
  actions,
  loading,
  imgPosition = 'top',
}: CardProps) {
  return (
    <StyledCard
      cover={
        <Cover>
          <a href={url}>
            <div className="gradient-container">
              <ImageLoader
                src={imgURL}
                fallback={imgFallbackURL}
                isLoading={loading}
                position={imgPosition}
              />
            </div>
          </a>
          <CoverFooter className="cover-footer">
            {!loading && coverLeft && (
              <CoverFooterLeft>{coverLeft}</CoverFooterLeft>
            )}
            {!loading && coverRight && (
              <CoverFooterRight>{coverRight}</CoverFooterRight>
            )}
          </CoverFooter>
        </Cover>
      }
    >
      {loading && (
        <Card.Meta
          title={
            <>
              <TitleContainer>
                <SkeletonTitle active size="small" />
                <div className="card-actions">
                  <Skeleton.Button active shape="circle" />{' '}
                  <SkeletonActions active />
                </div>
              </TitleContainer>
            </>
          }
          description={
            <ThinSkeleton
              round
              active
              title={false}
              paragraph={paragraphConfig}
            />
          }
        />
      )}
      {!loading && (
        <Card.Meta
          title={
            <>
              <TitleContainer>
                <TitleLink href={url}>{title}</TitleLink>
                {titleRight && <div className="title-right"> {titleRight}</div>}
                <div className="card-actions">{actions}</div>
              </TitleContainer>
            </>
          }
          description={description}
        />
      )}
    </StyledCard>
  );
}

ListViewCard.Actions = ActionsWrapper;
ListViewCard.MenuIcon = MenuIcon;
export default ListViewCard;
