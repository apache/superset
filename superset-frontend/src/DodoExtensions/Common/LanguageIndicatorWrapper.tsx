import { styled } from '@superset-ui/core';

// eslint-disable-next-line theme-colors/no-literal-colors
const LanguageIndicatorWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-direction: row;
  margin-bottom: 4px;
  min-height: 26px;
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  color: ${({ theme }) => theme.colors.grayscale.dark1};

  span {
    &:nth-child(n + 1) {
      margin-left: 12px;
    }
  }
  .editable-title--editing {
    color: ${({ theme }) => theme.colors.primary.base};
  }
  &:hover {
    .editable-title {
      color: ${({ theme }) => theme.colors.grayscale.base};
    }
    .editable-title--editing {
      color: ${({ theme }) => theme.colors.primary.base};
    }
  }
`;

export { LanguageIndicatorWrapper };
