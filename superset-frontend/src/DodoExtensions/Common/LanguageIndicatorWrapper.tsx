import { styled } from '@superset-ui/core';

// eslint-disable-next-line theme-colors/no-literal-colors
const LanguageIndicatorWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-direction: row;
  margin-bottom: 8px;
  min-height: 32px;

  span {
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }
  }
  &:hover {
    .editable-title {
      border-bottom: 1px solid ${({ theme }) => theme.colors.primary.base};
    }
    .editable-title--editing {
      border-bottom: 0;
    }
  }
`;

export { LanguageIndicatorWrapper };
