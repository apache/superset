import { styled } from '@superset-ui/core';

const StyledH4 = styled.h4`
  margin-top: 0;
`;
const StyledP = styled.p`
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const InfoPanelWrapper = styled.div`
  height: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
`;

const Alert = styled.div`
  line-height: 22px;
  color: #004085;
  background-color: #cce5ff;
  border: 1px solid #b8daff;
  border-radius: 4px;
  padding: 30px;
  width: 100%;
`;

const StyledCode = styled.code`
  padding: 2px 4px;
  font-size: 90%;
  border-radius: 4px;
  color: #028ffc;
  background-color: #f7f7f7;
`;

export {
  StyledH4,
  StyledP,
  InfoPanelWrapper,
  Alert,
  StyledCode
}
