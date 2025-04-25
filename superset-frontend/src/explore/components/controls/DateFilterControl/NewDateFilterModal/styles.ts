import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import { Checkbox, Button, Tabs } from 'antd';
import { SupersetTheme } from '@superset-ui/core';

// Update styled component props
interface ThemedProps {
  theme: SupersetTheme;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isInRange: boolean;
}

export const FilterContainer = styled.div`
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  border-radius: 16px;
  padding: 32px;
  width: 800px;
  max-width: 90vw;
  max-height: 63vh;
  overflow-y: auto;

  .ant-tabs-nav::before {
    border-bottom: none;
  }

  .ant-tabs-tab {
    padding: 12px 24px;
    margin: 0;
    font-weight: 500;
    transition: all 0.3s ease;
    color: ${({ theme }: ThemedProps) => theme.colors.primary.light1};

    &:hover {
      color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    }
  }

  .ant-tabs-tab-active {
    background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
    border-radius: 8px;

    .ant-tabs-tab-btn {
      color: ${({ theme }: ThemedProps) =>
        theme.colors.primary.base} !important;
      font-weight: 600;
    }
  }

  .ant-tabs-ink-bar {
    background: ${({ theme }: ThemedProps) => theme.colors.primary.base};
  }

  .ant-tabs-nav-list {
    background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
    padding: 4px;
    border-radius: 12px;
    gap: 4px;
  }

  .ant-input {
    border-radius: 8px;
    padding: 8px 16px;
    height: 42px;
    border: 1px solid ${({ theme }: ThemedProps) => theme.colors.primary.light3};
    transition: all 0.3s ease;

    &:hover,
    &:focus {
      border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
      box-shadow: 0 0 0 2px
        ${({ theme }: ThemedProps) => theme.colors.primary.light2};
    }
  }

  .ant-btn {
    height: 42px;
    padding: 0 24px;
    border-radius: 8px;
    font-weight: 500;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px
        ${({ theme }: ThemedProps) => `${theme.colors.primary.base}33`};
    }

    &.ant-btn-primary {
      background: ${({ theme }: ThemedProps) => theme.colors.primary.base};
      border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};

      &:hover {
        background: ${({ theme }: ThemedProps) => theme.colors.primary.dark1};
        border-color: ${({ theme }: ThemedProps) => theme.colors.primary.dark1};
      }
    }
  }

  .ant-select {
    .ant-select-selector {
      height: 42px;
      border-radius: 8px;
      padding: 0 16px;
      border: 1px solid
        ${({ theme }: ThemedProps) => theme.colors.primary.light3};

      .ant-select-selection-item {
        line-height: 40px;
      }
    }

    &:hover,
    &.ant-select-focused {
      .ant-select-selector {
        border-color: ${({ theme }: ThemedProps) =>
          theme.colors.primary.base} !important;
        box-shadow: 0 0 0 2px
          ${({ theme }: ThemedProps) => theme.colors.primary.light2} !important;
      }
    }
  }
`;

export const CalendarHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 0 12px;

  span {
    font-size: 16px;
    color: ${({ theme }: ThemedProps) => theme.colors.grayscale.dark1};
    font-weight: 600;
  }
`;

export const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const IconButton = styled(Button)`
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid ${({ theme }: ThemedProps) => theme.colors.primary.light3};
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }: ThemedProps) => theme.colors.primary.light3};
    border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    transform: translateY(-1px);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

export const CalendarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  padding: 12px;
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  border-radius: 12px;
  margin-bottom: 16px;

  > div {
    padding: 8px;
    text-align: center;
    font-size: 14px;

    &:first-of-type {
      color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    }
  }
`;

export const CalendarWrapper = styled.div`
  display: flex;
  gap: 32px;
`;

interface CalendarCellProps {
  isCurrentMonth: boolean;
  isSelected: boolean;
  isInRange: boolean;
}

export const CalendarCell = styled.div<CalendarCellProps>`
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  position: relative;

  ${({ isCurrentMonth }: ThemedProps) =>
    !isCurrentMonth &&
    `
    color: ${({ theme }: ThemedProps) => theme.colors.primary.light1};
  `}

  ${({ isSelected }: ThemedProps) =>
    isSelected &&
    `
    background: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    color: ${({ theme }: ThemedProps) => theme.colors.grayscale.light5};
    font-weight: 600;
    box-shadow: 0 4px 12px ${({ theme }: ThemedProps) => `${theme.colors.primary.base}4D`};
  `}

  ${({ isInRange }: ThemedProps) =>
    isInRange &&
    `
    background: ${({ theme }: ThemedProps) => theme.colors.primary.light3};
    color: ${({ theme }: ThemedProps) => theme.colors.primary.base};

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: ${({ theme }: ThemedProps) => theme.colors.primary.base};
      opacity: 0.1;
      border-radius: 8px;
    }
  `}

  &:hover {
    background: ${({ theme }: ThemedProps) => theme.colors.primary.light3};
    transform: translateY(-1px);
  }
`;

export const DateInput = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  padding: 20px;
  border-radius: 12px;

  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    color: ${({ theme }: ThemedProps) => theme.colors.grayscale.dark1};
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

export const ShortcutsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;
  padding: 20px;
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  border-radius: 12px;
`;

export const ShortcutButton = styled.button`
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  border: 1px solid ${({ theme }: ThemedProps) => theme.colors.primary.light3};
  padding: 8px 16px;
  border-radius: 8px;
  color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: ${({ theme }: ThemedProps) => theme.colors.primary.light3};
    border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    transform: translateY(-1px);
    box-shadow: 0 2px 8px
      ${({ theme }: ThemedProps) => `${theme.colors.primary.base}26`};
  }

  &:active {
    transform: translateY(0);
  }
`;

export const ActualTimeRange = styled.div`
  margin-top: 24px;
  padding: 20px;
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  border-radius: 12px;
  border: 1px solid ${({ theme }: ThemedProps) => theme.colors.primary.light3};
`;

export const TimeRangeTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: ${({ theme }: ThemedProps) => theme.colors.grayscale.dark1};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
`;

export const TimeRangeValue = styled.div`
  color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
  font-family: monospace;
  font-size: 14px;
`;

export const FooterContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
`;

export const ButtonContainer = styled.div`
  display: flex;
  gap: 8px;
`;

export const StyledCheckbox = styled(Checkbox)`
  .ant-checkbox-checked .ant-checkbox-inner {
    background-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
  }

  .ant-checkbox-wrapper:hover .ant-checkbox-inner,
  .ant-checkbox:hover .ant-checkbox-inner {
    border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
  }

  .ant-checkbox-wrapper {
    color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
  }
`;

export const AbsoluteModeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const RelativeModeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

export const FilterTitle = styled.label`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
`;

export const DynamicFilterTabs = styled(Tabs)`
  .ant-tabs-card {
    .ant-tabs-nav {
      margin-bottom: 24px;
    }

    .ant-tabs-tab {
      background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
      border: none;
      border-radius: 8px;
      padding: 8px 24px;
      transition: all 0.3s ease;

      &:hover {
        color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
      }

      &.ant-tabs-tab-active {
        background: ${({ theme }: ThemedProps) => theme.colors.primary.base};

        .ant-tabs-tab-btn {
          color: ${({ theme }: ThemedProps) =>
            theme.colors.grayscale.light5} !important;
        }
      }
    }

    .ant-tabs-nav-list {
      gap: 8px;
      padding: 0;
    }
  }
`;

export const RadioGroup = styled.div`
  background: ${({ theme }: ThemedProps) => theme.colors.primary.light4};
  padding: 24px;
  border-radius: 12px;

  .ant-radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ant-radio-wrapper {
    color: ${({ theme }: ThemedProps) => theme.colors.grayscale.dark1};
    transition: all 0.3s ease;
    padding: 8px 16px;
    margin-right: 0;
    border-radius: 8px;
    font-size: 16px;

    &:hover {
      background: ${({ theme }: ThemedProps) => theme.colors.primary.light3};
      color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    }

    .ant-radio-checked {
      .ant-radio-inner {
        border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
        background: ${({ theme }: ThemedProps) => theme.colors.primary.base};
      }
    }

    .ant-radio:hover .ant-radio-inner {
      border-color: ${({ theme }: ThemedProps) => theme.colors.primary.base};
    }
  }
`;
