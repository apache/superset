/* eslint-disable theme-colors/no-literal-colors */
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import { Checkbox, Button, Tabs } from 'antd';

export const FilterContainer = styled.div`
  background: white;
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
    color: #93d5e4;

    &:hover {
      color: #1ea7c9;
    }
  }

  .ant-tabs-tab-active {
    background: #f0f9fb;
    border-radius: 8px;

    .ant-tabs-tab-btn {
      color: #1ea7c9 !important;
      font-weight: 600;
    }
  }

  .ant-tabs-ink-bar {
    background: #1ea7c9;
  }

  .ant-tabs-nav-list {
    background: #f7fbfc;
    padding: 4px;
    border-radius: 12px;
    gap: 4px;
  }

  .ant-input {
    border-radius: 8px;
    padding: 8px 16px;
    height: 42px;
    border: 1px solid #e6f3f7;
    transition: all 0.3s ease;

    &:hover,
    &:focus {
      border-color: #1ea7c9;
      box-shadow: 0 0 0 2px rgba(30, 167, 201, 0.1);
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
      box-shadow: 0 4px 12px rgba(30, 167, 201, 0.2);
    }

    &.ant-btn-primary {
      background: #1ea7c9;
      border-color: #1ea7c9;

      &:hover {
        background: #1797b8;
        border-color: #1797b8;
      }
    }
  }

  .ant-select {
    .ant-select-selector {
      height: 42px;
      border-radius: 8px;
      padding: 0 16px;
      border: 1px solid #e6f3f7;

      .ant-select-selection-item {
        line-height: 40px;
      }
    }

    &:hover,
    &.ant-select-focused {
      .ant-select-selector {
        border-color: #1ea7c9 !important;
        box-shadow: 0 0 0 2px rgba(30, 167, 201, 0.1) !important;
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
    color: #0c4a58;
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
  border: 1px solid #e6f3f7;
  background: white;
  transition: all 0.2s ease;

  &:hover {
    background: #f0f9fb;
    border-color: #1ea7c9;
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
  background: #f7fbfc;
  border-radius: 12px;
  margin-bottom: 16px;

  > div {
    padding: 8px;
    text-align: center;
    font-size: 14px;

    &:first-of-type {
      color: #1ea7c9;
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

  ${({ isCurrentMonth }) =>
    !isCurrentMonth &&
    `
    color: #93d5e4;
  `}

  ${({ isSelected }) =>
    isSelected &&
    `
    background: #1EA7C9;
    color: white;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(30, 167, 201, 0.3);
  `}

  ${({ isInRange }) =>
    isInRange &&
    `
    background: #f0f9fb;
    color: #1EA7C9;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: #1EA7C9;
      opacity: 0.1;
      border-radius: 8px;
    }
  `}

  &:hover {
    background: ${({ isSelected }) => (isSelected ? '#1EA7C9' : '#f0f9fb')};
    transform: translateY(-1px);
  }
`;

export const DateInput = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 24px;
  background: #f7fbfc;
  padding: 20px;
  border-radius: 12px;

  label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #0c4a58;
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
  background: #f7fbfc;
  border-radius: 12px;
`;

export const ShortcutButton = styled.button`
  background: white;
  border: 1px solid #e6f3f7;
  padding: 8px 16px;
  border-radius: 8px;
  color: #1ea7c9;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f0f9fb;
    border-color: #1ea7c9;
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(30, 167, 201, 0.15);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const ActualTimeRange = styled.div`
  margin-top: 24px;
  padding: 20px;
  background: #f7fbfc;
  border-radius: 12px;
  border: 1px solid #e6f3f7;
`;

export const TimeRangeTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #0c4a58;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
`;

export const TimeRangeValue = styled.div`
  color: #1ea7c9;
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
    background-color: #1ea7c9;
    border-color: #1ea7c9;
  }

  .ant-checkbox-wrapper:hover .ant-checkbox-inner,
  .ant-checkbox:hover .ant-checkbox-inner {
    border-color: #1ea7c9;
  }

  .ant-checkbox-wrapper {
    color: #1ea7c9;
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
      background: #f7fbfc;
      border: none;
      border-radius: 8px;
      padding: 8px 24px;
      transition: all 0.3s ease;

      &:hover {
        color: #1ea7c9;
      }

      &.ant-tabs-tab-active {
        background: #1ea7c9;

        .ant-tabs-tab-btn {
          color: white !important;
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
  background: #f7fbfc;
  padding: 24px;
  border-radius: 12px;

  .ant-radio-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .ant-radio-wrapper {
    color: #0c4a58;
    transition: all 0.3s ease;
    padding: 8px 16px;
    margin-right: 0;
    border-radius: 8px;
    font-size: 16px;

    &:hover {
      background: #e6f3f7;
      color: #1ea7c9;
    }

    .ant-radio-checked {
      .ant-radio-inner {
        border-color: #1ea7c9;
        background: #1ea7c9;
      }
    }

    .ant-radio:hover .ant-radio-inner {
      border-color: #1ea7c9;
    }
  }
`;
