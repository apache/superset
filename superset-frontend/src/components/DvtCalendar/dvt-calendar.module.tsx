import { styled } from '@superset-ui/core';

interface StyledCalendarProps {
  isCalendarVisible: boolean;
}

const StyledCalendar = styled.div<StyledCalendarProps>`
  width: 308px;
  height: 315px;
  display: ${({ isCalendarVisible }) => (isCalendarVisible ? 'block' : 'none')};
`;

const StyledCalendarIcon = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
`;

export { StyledCalendar, StyledCalendarIcon };
