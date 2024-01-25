import React, { ReactNode, SyntheticEvent } from 'react';
import { styled, css, SupersetTheme } from '@superset-ui/core';
import Button from 'src/components/Button';
import { NoResultsIcon } from 'src/Superstructure/components/NoResultsIcon';

export enum EmptyStateSize {
  Small,
  Medium,
  Big,
}

export interface EmptyStateSmallProps {
  title: ReactNode;
  description?: ReactNode;
  image: ReactNode;
}

export interface EmptyStateProps extends EmptyStateSmallProps {
  buttonText?: ReactNode;
  buttonAction?: React.MouseEventHandler<HTMLElement>;
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

const handleMouseDown = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const EmptyStateBig = ({
  title,
  // image,
  description,
  buttonAction,
  buttonText,
}: EmptyStateProps) => (
  <EmptyStateContainer>
    {/* <ImageContainer image={image} size={EmptyStateSize.Big} /> */}
    <NoResultsIcon />
    <TextContainer
      css={(theme: SupersetTheme) =>
        css`
          max-width: ${theme.gridUnit * 150}px;
        `
      }
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
    {/* <ImageContainer image={image} size={EmptyStateSize.Medium} /> */}
    <NoResultsIcon />
    <TextContainer
      css={(theme: SupersetTheme) =>
        css`
          max-width: ${theme.gridUnit * 100}px;
        `
      }
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
    {/* <ImageContainer image={image} size={EmptyStateSize.Small} /> */}
    <NoResultsIcon />
    <TextContainer
      css={(theme: SupersetTheme) =>
        css`
          max-width: ${theme.gridUnit * 75}px;
        `
      }
    >
      <Title>{title}</Title>
      {description && <SmallDescription>{description}</SmallDescription>}
    </TextContainer>
  </EmptyStateContainer>
);
