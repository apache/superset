import { styled } from '@superset-ui/core';

const StyledChartAdd = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 15px;
`;

const StyledChart = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 30px;
  height: 100%;
`;

const StyledImgRender = styled.div`
  display: flex;
  flex-direction: column;
  gap: 22px;
  font-size: 18px;
  font-weight: 700;
  line-height: 140%;
  letter-spacing: 0.2px;
  max-width: 547px;
`;

export { StyledChartAdd, StyledChart, StyledImgRender };
