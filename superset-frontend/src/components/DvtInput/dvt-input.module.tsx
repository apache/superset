import { styled } from '@superset-ui/core';

interface StyledInputProps {
  $size: string;
}

const sizes = {
  small: 40,
  medium: 48,
  large: 56,
};

const StyledInput = styled.div<StyledInputProps>`
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${({ theme }) => theme.colors.dvt.primary.light2};
  padding: 8px 16px;
  border-radius: 12px;
  width: 100%;
  height: ${({ $size }) => sizes[$size]}px;
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

const StyledInputIcon = styled.div`
  cursor: pointer;
`;

export { StyledInput, StyledInputField, StyledInputIcon };
