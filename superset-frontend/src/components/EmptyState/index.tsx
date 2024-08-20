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

import {
  ReactNode,
  SyntheticEvent,
  MouseEventHandler as ReactMouseEventHandler,
} from 'react';
import { styled, css, SupersetTheme, t } from '@superset-ui/core';
import { Empty } from 'src/components';
import Button from 'src/components/Button';

export enum EmptyStateSize {
  Small,
  Medium,
  Big,
}

export interface EmptyStateSmallProps {
  title?: ReactNode;
  description?: ReactNode;
  image?: ReactNode;
}

export interface EmptyStateProps extends EmptyStateSmallProps {
  buttonText?: ReactNode;
  buttonAction?: ReactMouseEventHandler<HTMLElement>;
  className?: string;
}

export interface ImageContainerProps {
  image: ReactNode;
  size: EmptyStateSize;
}

const EmptyStateContainer = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    padding: ${theme.gridUnit * 4}px;
    text-align: center;

    & .ant-empty-image svg {
      width: auto;
    }

    & a,
    & span[role='button'] {
      color: inherit;
      text-decoration: underline;
      &:hover {
        color: ${theme.colors.grayscale.base};
      }
    }
  `}
`;

const TextContainer = styled.div``;

const Title = styled.p`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.m}px;
    color: ${theme.colors.grayscale.light1};
    margin: ${theme.gridUnit * 2}px 0 0 0;
    font-weight: ${theme.typography.weights.bold};
  `}
`;

const BigTitle = styled(Title)`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.l}px;
    color: ${theme.colors.grayscale.light1};
    margin-top: ${theme.gridUnit * 4}px;
  `}
`;

const Description = styled.p`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.s}px;
    color: ${theme.colors.grayscale.light1};
    margin: ${theme.gridUnit * 2}px 0 0 0;
  `}
`;

const BigDescription = styled(Description)`
  ${({ theme }) => css`
    font-size: ${theme.typography.sizes.m}px;
  `}
`;

const SmallDescription = styled(Description)`
  ${({ theme }) => css`
    margin-top: ${theme.gridUnit}px;
    line-height: 1.2;
  `}
`;

const ActionButton = styled(Button)`
  ${({ theme }) => css`
    margin-top: ${theme.gridUnit * 4}px;
    z-index: 1;
  `}
`;

const getImage = (image: string | ReactNode) =>
  typeof image === 'string' ? `/static/assets/images/${image}` : image;

const getImageHeight = (size: EmptyStateSize) => {
  switch (size) {
    case EmptyStateSize.Small:
      return { height: '50px' };
    case EmptyStateSize.Medium:
      return { height: '80px' };
    case EmptyStateSize.Big:
      return { height: '150px' };
    default:
      return { height: '50px' };
  }
};

const ImageContainer = ({ image, size }: ImageContainerProps) => (
  <Empty
    description={false}
    image={getImage(image)}
    imageStyle={getImageHeight(size)}
  />
);

const handleMouseDown = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const EmptyStateBig = ({
  title,
  image,
  description,
  buttonAction,
  buttonText,
  className,
}: EmptyStateProps) => (
  <EmptyStateContainer className={className}>
    {image && <ImageContainer image={image} size={EmptyStateSize.Big} />}
    <TextContainer
      css={(theme: SupersetTheme) => css`
        max-width: ${theme.gridUnit * 150}px;
      `}
    >
      <BigTitle>{title}</BigTitle>
      {description && <BigDescription>{description}</BigDescription>}
      {buttonAction && buttonText && (
        <ActionButton
          buttonStyle="primary"
          onClick={buttonAction}
          onMouseDown={handleMouseDown}
        >
          {buttonText}
        </ActionButton>
      )}
    </TextContainer>
  </EmptyStateContainer>
);

export const EmptyStateMedium = ({
  title,
  image,
  description,
  buttonAction,
  buttonText,
}: EmptyStateProps) => (
  <EmptyStateContainer>
    {image && <ImageContainer image={image} size={EmptyStateSize.Medium} />}
    <TextContainer
      css={(theme: SupersetTheme) => css`
        max-width: ${theme.gridUnit * 100}px;
      `}
    >
      <Title>{title}</Title>
      {description && <Description>{description}</Description>}
      {buttonText && buttonAction && (
        <ActionButton
          buttonStyle="primary"
          onClick={buttonAction}
          onMouseDown={handleMouseDown}
        >
          {buttonText}
        </ActionButton>
      )}
    </TextContainer>
  </EmptyStateContainer>
);

export const EmptyStateSmall = ({
  title,
  image,
  description,
}: EmptyStateSmallProps) => (
  <EmptyStateContainer>
    {image && <ImageContainer image={image} size={EmptyStateSize.Small} />}
    <TextContainer
      css={(theme: SupersetTheme) => css`
        max-width: ${theme.gridUnit * 75}px;
      `}
    >
      <Title>{title}</Title>
      {description && <SmallDescription>{description}</SmallDescription>}
    </TextContainer>
  </EmptyStateContainer>
);

const TRANSLATIONS = {
  NO_DATABASES_MATCH_TITLE: t('No databases match your search'),
  NO_DATABASES_AVAILABLE_TITLE: t('There are no databases available'),
  MANAGE_YOUR_DATABASES_TEXT: t('Manage your databases'),
  HERE_TEXT: t('here'),
};

export const emptyStateComponent = (emptyResultsWithSearch: boolean) => (
  <EmptyStateSmall
    image="empty.svg"
    title={
      emptyResultsWithSearch
        ? TRANSLATIONS.NO_DATABASES_MATCH_TITLE
        : TRANSLATIONS.NO_DATABASES_AVAILABLE_TITLE
    }
    description={
      <p>
        {TRANSLATIONS.MANAGE_YOUR_DATABASES_TEXT}{' '}
        <a href="/databaseview/list">{TRANSLATIONS.HERE_TEXT}</a>
      </p>
    }
  />
);
