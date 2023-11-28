import { styled } from '@superset-ui/core';

const StyledDvtTitleCardList = styled.div`
  display: flex;
  flex-direction: column;
`;

const StyledDvtCardList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const DvtCardListHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
`;

const DvtCardListButton = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  cursor: pointer;
  transition: transform 0.2s ease;
`;

export {
  StyledDvtTitleCardList,
  DvtCardListHead,
  DvtCardListButton,
  StyledDvtCardList,
};
