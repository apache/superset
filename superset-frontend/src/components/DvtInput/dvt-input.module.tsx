import { styled } from '@superset-ui/core';

const StyledInput = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 12px;
  width: 100%;
  height: 56px;
`;

const StyledInputField = styled.input`
  width: 100%;
  height: 100%;
  border: none;
  color: ${({ theme }) => theme.colors.dvt.text.bold};
  &:focus {
    outline: none;
  }
  &::placeholder {
    color: ${({ theme }) => theme.colors.dvt.text.help};
  }
`;

const StyledInputPasswordIcon = styled.div``;

export { StyledInput, StyledInputField, StyledInputPasswordIcon };
