import { styled } from '@superset-ui/core';

const StyledDvtContent = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  background-color: ${({ theme }) => theme.colors.grayscale.light5};
`;

const StyledDvtContentTitle = styled.div`
  display: flex;
  font-size: 16px;
  font-weight: 700;
  line-height: 150%;
  letter-spacing: 0.2px;
  color: ${({ theme }) => theme.colors.dvt.text.bold};
`;

const StyledDvtContentSubtitle = styled.div`
  display: flex;
  width: 695px;
  height: 51px;
  background: ${({ theme }) => theme.colors.dvt.grayscale.light2};
  flex-direction: row;
  justify-content: space-between;
`;
const StyledDvtContentScroll = styled.div`
  display: flex;
  overflow-y: auto;
  flex-direction: column;
  padding-right: 10px;

  &::-webkit-scrollbar {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.light1};
    width: 6px;
    border-radius: 12px;
  }
  &::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.dvt.grayscale.base};
    width: 4px;
    border-radius: 12px;
  }
`;
const StyledDvtContentSubtitleP = styled.p`
  font-size: 12px;
  font-weight: 500;
  line-height: 160%;
  color: ${({ theme }) => theme.colors.dvt.text.help};
`;

export {
  StyledDvtContent,
  StyledDvtContentTitle,
  StyledDvtContentSubtitle,
  StyledDvtContentScroll,
  StyledDvtContentSubtitleP,
};
