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
import { styled, useTheme } from '@superset-ui/core';
import { Skeleton, AntdCard } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import ImageLoader, { BackgroundPosition } from './ImageLoader';
import CertifiedBadge from '../CertifiedBadge';

const ActionsWrapper = styled.div`
  width: 64px;
  display: flex;
  justify-content: space-between;
`;

const StyledCard = styled(AntdCard)`
  border: 1px solid #d9dbe4;
  border-radius: ${({ theme }) => theme.gridUnit}px;
  overflow: hidden;

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
  border-bottom: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
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
    padding-left: ${({ theme }) => theme.gridUnit}px;
    span[role='img'] {
      display: flex;
      align-items: center;
    }
  }
`;

const TitleLink = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  & a {
    color: ${({ theme }) => theme.colors.grayscale.dark1} !important;
  }
`;

const TitleRight = styled.span`
  position: absolute;
  right: -1px;
  bottom: ${({ theme }) => theme.gridUnit}px;
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

const ThinSkeleton = styled(Skeleton)`
  h3 {
    margin: ${({ theme }) => theme.gridUnit}px 0;
  }

  ul {
    margin-bottom: 0;
  }
`;

const paragraphConfig = { rows: 1, width: 150 };

interface LinkProps {
  to: string;
}

const AnchorLink: React.FC<LinkProps> = ({ to, children }) => (
  <a href={to}>{children}</a>
);

interface CardProps {
  title?: React.ReactNode;
  url?: string;
  linkComponent?: React.ComponentType<LinkProps>;
  imgURL?: string;
  imgFallbackURL?: string;
  imgPosition?: BackgroundPosition;
  description: string;
  loading?: boolean;
  titleRight?: React.ReactNode;
  coverLeft?: React.ReactNode;
  coverRight?: React.ReactNode;
  actions?: React.ReactNode | null;
  rows?: number | string;
  avatar?: React.ReactElement | null;
  cover?: React.ReactNode | null;
  certifiedBy?: string;
  certificationDetails?: string;
}

function ListViewCard({
  title,
  url,
  linkComponent,
  titleRight,
  imgURL,
  imgFallbackURL,
  description,
  coverLeft,
  coverRight,
  actions,
  avatar,
  loading,
  imgPosition = 'top',
  cover,
  certifiedBy,
  certificationDetails,
}: CardProps) {
  const Link = url && linkComponent ? linkComponent : AnchorLink;
  const theme = useTheme();
  return (
    <StyledCard
      data-test="styled-card"
      cover={
        cover || (
          <Cover>
            <Link to={url!}>
              <div className="gradient-container">
                <ImageLoader
                  src={imgURL || ''}
                  fallback={imgFallbackURL || ''}
                  isLoading={loading}
                  position={imgPosition}
                />
              </div>
            </Link>
            <CoverFooter className="cover-footer">
              {!loading && coverLeft && (
                <CoverFooterLeft>{coverLeft}</CoverFooterLeft>
              )}
              {!loading && coverRight && (
                <CoverFooterRight>{coverRight}</CoverFooterRight>
              )}
            </CoverFooter>
          </Cover>
        )
      }
    >
      {loading && (
        <AntdCard.Meta
          title={
            <>
              <TitleContainer>
                <Skeleton.Input
                  active
                  size="small"
                  css={{
                    width: Math.trunc(theme.gridUnit * 62.5),
                  }}
                />
                <div className="card-actions">
                  <Skeleton.Button active shape="circle" />{' '}
                  <Skeleton.Button
                    active
                    css={{
                      width: theme.gridUnit * 10,
                    }}
                  />
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
        <AntdCard.Meta
          title={
            <TitleContainer>
              <Tooltip title={title}>
                <TitleLink>
                  <Link to={url!}>
                    {certifiedBy && (
                      <>
                        <CertifiedBadge
                          certifiedBy={certifiedBy}
                          details={certificationDetails}
                        />{' '}
                      </>
                    )}
                    {title}
                  </Link>
                </TitleLink>
              </Tooltip>
              {titleRight && <TitleRight>{titleRight}</TitleRight>}
              <div className="card-actions" data-test="card-actions">
                {actions}
              </div>
            </TitleContainer>
          }
          description={description}
          avatar={avatar || null}
        />
      )}
    </StyledCard>
  );
}

ListViewCard.Actions = ActionsWrapper;

export default ListViewCard;
