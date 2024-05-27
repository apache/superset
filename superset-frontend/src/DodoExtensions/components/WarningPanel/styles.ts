/* eslint-disable theme-colors/no-literal-colors */
import { styled } from '@superset-ui/core';
import Button from '../../../components/Button';

const StyledH4 = styled.h4`
  margin-top: 0;
`;
const StyledP = styled.p`
  hyphens: auto;
  margin-bottom: 10px;
  &:last-child {
    margin-bottom: 0;
  }
`;
const WarningPanelWrapper = styled.div<{ backgroundColor: string }>`
  display: flex;
  background-color: ${props => props.backgroundColor};
  align-items: flex-start;
  justify-content: space-between;

  border: 1px solid #ffeeba;
  border-radius: 2px;
`;

const Alert = styled.div`
  line-height: 22px;
  color: #856404;
  padding: 25px;
  width: 100%;
`;

const StyledCode = styled.code`
  padding: 2px 4px;
  font-size: 90%;
  border-radius: 2px;
  color: #856404;
  background-color: #f7f7f7;
`;

const StyledButton = styled(Button)`
  padding: 0;
`;

export {
  StyledH4,
  StyledP,
  WarningPanelWrapper,
  Alert,
  StyledCode,
  StyledButton,
};
