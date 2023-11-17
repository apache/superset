import { styled } from '@superset-ui/core';

interface StyledCalendarProps {
  isCalendarVisible: boolean;
}

const StyledCalendar = styled.div<StyledCalendarProps>`
  width: 308px;
  height: 315px;
  display: ${({ isCalendarVisible }) => (isCalendarVisible ? 'block' : 'none')};
  tr {
    th {
      font-weight: 600;
      text-align: center;
    }

    &:first-of-type {
      position: relative;
      margin: 15px;
    }
  }
  tbody {
    tr {
      td {
        position: relative;
      }

      &:last-of-type{
        display: none;
      }
    }
  }
  .ant-picker-cell-inner.ant-picker-calendar-date.ant-picker-calendar-date-today {
    ::before {
      border: none;
    }
  }

  .ant-picker-cell.ant-picker-cell-in-view.ant-picker-cell-selected {
    .ant-picker-cell-inner.ant-picker-calendar-date {
      border-radius: 50px;
      background-color: ${({ theme }) => theme.colors.dvt.primary.base};
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.2);
    }
  }
`;

const StyledCalendarIcon = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
`;

export { StyledCalendar, StyledCalendarIcon };
