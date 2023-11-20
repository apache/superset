import { styled } from '@superset-ui/core';

interface StyledCalendarProps {
  isCalendarVisible: boolean;
}

const StyledCalendar = styled.div<StyledCalendarProps>`
  width: 308px;
  display: ${({ isCalendarVisible }) => (isCalendarVisible ? 'block' : 'none')};
  tr {
    th {
      font-weight: 600;
      text-align: center;
    }
  }
  tbody {
    tr {
      &:last-of-type {
        display: none;
      }
    }
  }
`;

const StyledCalendarIcon = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
`;

export { StyledCalendar, StyledCalendarIcon };
