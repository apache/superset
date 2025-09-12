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
import { ReactNode, SyntheticEvent } from 'react';
import { styled, css, SupersetTheme, t } from '@superset-ui/core';

// Importing svg images
import FilterResultsImage from './svgs/filter-results.svg';
import ChartImage from '../assets/svgs/chart.svg';
import FilterImage from './svgs/filter.svg';
import EmptyChartsImage from './svgs/empty-charts.svg';
import EmptyDashboardImage from './svgs/empty-dashboard.svg';
import UnionImage from './svgs/union.svg';
import StarCircleImage from './svgs/star-circle.svg';
import VectorImage from './svgs/vector.svg';
import DocumentImage from './svgs/document.svg';
import DatasetImage from './svgs/empty-dataset.svg';
import EmptySqlChartImage from './svgs/empty_sql_chart.svg';
import EmptyQueryImage from './svgs/empty-query.svg';
import EmptyTableImage from './svgs/empty-table.svg';
import EmptyImage from './svgs/empty.svg';
import { Button, Empty } from '..';
import type { EmptyStateProps, EmptyStateSize } from './types';

export const imageMap = {
  'chart.svg': <ChartImage />,
  'document.svg': <DocumentImage />,
  'empty-charts.svg': <EmptyChartsImage />,
  'empty-dashboard.svg': <EmptyDashboardImage />,
  'empty-dataset.svg': <DatasetImage />,
  'empty-query.svg': <EmptyQueryImage />,
  'empty-table.svg': <EmptyTableImage />,
  'empty.svg': <EmptyImage />,
  'empty_sql_chart.svg': <EmptySqlChartImage />,
  'filter-results.svg': <FilterResultsImage />,
  'filter.svg': <FilterImage />,
  'star-circle.svg': <StarCircleImage />,
  'union.svg': <UnionImage />,
  'vector.svg': <VectorImage />,
};

const EmptyStateContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    color: ${theme.colorTextTertiary};
    align-items: center;
    justify-content: center;
    padding: ${theme.sizeUnit * 4}px;
    text-align: center;

    & .ant-empty-image svg {
      width: auto;
    }

    & a,
    & span[role='button'] {
      color: inherit;
      text-decoration: underline;
      &:hover {
        color: ${theme.colorText};
      }
    }
  `}
`;

const Title = styled.p<{ size: EmptyStateSize }>`
  ${({ theme, size }) => css`
    font-size: ${size === 'large' ? theme.fontSizeLG : theme.fontSize}px;
    color: ${theme.colorTextTertiary};
    margin-top: ${size === 'large' ? theme.sizeUnit * 4 : theme.sizeUnit * 2}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Description = styled.p<{ size: EmptyStateSize }>`
  ${({ theme, size }) => css`
    font-size: ${size === 'large' ? theme.fontSize : theme.fontSizeSM}px;
    color: ${theme.colorTextTertiary};
    margin-top: ${theme.sizeUnit * 2}px;
  `}
`;

const getImageHeight = (size: EmptyStateSize) => {
  switch (size) {
    case 'small':
      return { height: '50px' };
    case 'medium':
      return { height: '80px' };
    case 'large':
      return { height: '150px' };
    default:
      return { height: '80px' };
  }
};

const ImageContainer = ({
  image,
  size,
}: {
  image?: ReactNode | string;
  size: EmptyStateSize;
}) => {
  if (!image) return null;
  const mappedImage =
    typeof image === 'string'
      ? imageMap[image as keyof typeof imageMap]
      : image;
  return (
    <div role="img" aria-label="empty">
      <Empty
        description={false}
        image={mappedImage}
        styles={{ image: getImageHeight(size) }}
      />
    </div>
  );
};

const handleMouseDown = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = t('No results'),
  description = t('There is currently no information to display.'),
  image = 'empty.svg',
  buttonText,
  buttonIcon,
  buttonAction,
  size = 'medium',
  children,
}) => (
  <EmptyStateContainer>
    {image && <ImageContainer image={image} size={size} />}
    <div
      css={(theme: SupersetTheme) => css`
        max-width: ${size === 'large'
          ? theme.sizeUnit * 150
          : theme.sizeUnit * 100}px;
      `}
    >
      {title && <Title size={size}>{title}</Title>}
      {description && (
        <Description size={size} className="ant-empty-description">
          {description}
        </Description>
      )}
      {buttonText && buttonAction && (
        <Button
          icon={buttonIcon}
          buttonStyle="primary"
          onClick={buttonAction}
          onMouseDown={handleMouseDown}
          css={(theme: SupersetTheme) => css`
            margin-top: ${theme.sizeUnit * 4}px;
            z-index: 1;
            box-shadow: none;
          `}
        >
          {buttonText}
        </Button>
      )}
      {children}
    </div>
  </EmptyStateContainer>
);

export type { EmptyStateProps };
