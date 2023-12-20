import { styled } from '@superset-ui/core';

const StyledConnection = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;
`;

const StyledConnectionButton = styled.div`
  display: flex;
  justify-content: space-between;
  flex: end;
  padding: 30px 0px 36px 0px;
`;

export { StyledConnection, StyledConnectionButton };
