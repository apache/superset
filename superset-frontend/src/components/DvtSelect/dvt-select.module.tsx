import { styled } from '@superset-ui/core';

interface StyledSelectProps {
  isOpen: boolean;
}
const StyledSelect = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledSelectSelect = styled.div<StyledSelectProps>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  width: 202px;
  height: 48px;
  border-radius: 12px;
  background-color: ${({ isOpen, theme }) =>
    isOpen
      ? theme.colors.dvt.primary.light2
      : theme.colors.dvt.grayscale.light2};
  border: none;
  appearance: none;
  margin-bottom: 3px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.dvt.primary.light1};
`;

const StyledSelectLabel = styled.label`
  padding-left: 13px;
  font-weight: 600;
`;

const StyledSelectOption = styled.div`
  padding: 13px;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.dvt.primary.light1};
  &:hover {
    background: ${({ theme }) => theme.colors.dvt.primary.light1};
    color: ${({ theme }) => theme.colors.grayscale.light5};
    &:first-of-type {
      border-radius: 12px 12px 0px 0px;
    }
    &:last-of-type {
      border-radius: 0px 0px 12px 12px;
    }
  }
`;
const StyledSelectOptions = styled.div`
  width: 202px;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.dvt.primary.light2};
`;
const StyledSelectIcon = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export {
  StyledSelect,
  StyledSelectOption,
  StyledSelectLabel,
  StyledSelectSelect,
  StyledSelectIcon,
  StyledSelectOptions,
};
