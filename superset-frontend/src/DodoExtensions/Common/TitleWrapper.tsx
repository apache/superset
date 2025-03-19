import { styled } from '@superset-ui/core';

const TitleWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  flex-direction: row;
  margin-bottom: 8px;

  span {
    margin-left: 12px;

    &:first-child {
      margin-left: 0;
    }
  }
`;

export { TitleWrapper };
