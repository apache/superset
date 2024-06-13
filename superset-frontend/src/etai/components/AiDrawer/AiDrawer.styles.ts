import { styled } from '@superset-ui/core';

export const AiWrapper = styled.div`
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
  margin-right: ${({ theme }) => theme.gridUnit * 4}px;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`;
