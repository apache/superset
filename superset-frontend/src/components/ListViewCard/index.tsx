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
import { ReactNode, ComponentType, ReactElement, FC } from 'react';
import { styled, useTheme } from '@superset-ui/core';
import { Skeleton, Card } from 'src/components';
import { Tooltip } from 'src/components/Tooltip';
import { theme as supersetTheme } from 'src/preamble';
import { ConfigProvider } from 'antd-v5';
import ImageLoader, { BackgroundPosition } from './ImageLoader';
import CertifiedBadge from '../CertifiedBadge';

const ActionsWrapper = styled.div`
  width: 64px;
  display: flex;
  justify-content: flex-end;
`;

// Styling part 1: Override Card tokens when possible
const listViewCardTheme = {
  components: {
    Card: {
      colorBgContainer: supersetTheme.colors.grayscale.light5,
    },
  },
};

// Styling part 2: Use CSS when necessary
const StyledCard = styled(Card)`
  ${({ theme }) => `
    overflow: hidden;

    .gradient-container {
      position: relative;
      height: 100%;
    }
    &:hover {
      box-shadow: 8px 8px 28px 0px ${theme.colors.grayscale.light1};
      transition: box-shadow ${theme.transitionTiming}s ease-in-out;

      .cover-footer {
        transform: translateY(0);
      }
    }
  `}
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
  flex-direction: column;

  .card-actions {
    margin-left: auto;
    align-self: flex-end;
    padding-left: ${({ theme }) => theme.gridUnit}px;
    span[role='img'] {
      display: flex;
      align-items: center;
    }
  }

  .titleRow {
    display: flex;
    justify-content: flex-start;
    flex-direction: row;
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
  font-weight: 400;
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

const AnchorLink: FC<LinkProps> = ({ to, children }) => (
  <a href={to}>{children}</a>
);

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  url?: string;
  linkComponent?: ComponentType<LinkProps>;
  imgURL?: string | null;
  imgFallbackURL?: string;
  imgPosition?: BackgroundPosition;
  description: string;
  loading?: boolean;
  titleRight?: ReactNode;
  coverLeft?: ReactNode;
  coverRight?: ReactNode;
  actions?: ReactNode | null;
  rows?: number | string;
  avatar?: ReactElement | null;
  cover?: ReactNode | null;
  certifiedBy?: string;
  certificationDetails?: string;
}

function ListViewCard({
  title,
  subtitle,
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
    <ConfigProvider theme={listViewCardTheme}>
      <StyledCard
        data-test="styled-card"
        padded
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
          <Card.Meta
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
          <Card.Meta
            title={
              <TitleContainer>
                {subtitle || null}
                <div className="titleRow">
                  <Tooltip title={title}>
                    <TitleLink>
                      {certifiedBy && (
                        <>
                          <CertifiedBadge
                            certifiedBy={certifiedBy}
                            details={certificationDetails}
                          />{' '}
                        </>
                      )}
                      {title}
                    </TitleLink>
                  </Tooltip>
                  {titleRight && <TitleRight>{titleRight}</TitleRight>}
                  <div className="card-actions" data-test="card-actions">
                    {actions}
                  </div>
                </div>
              </TitleContainer>
            }
            description={description}
            avatar={avatar || null}
          />
        )}
      </StyledCard>
    </ConfigProvider>
  );
}

ListViewCard.Actions = ActionsWrapper;

export default ListViewCard;
