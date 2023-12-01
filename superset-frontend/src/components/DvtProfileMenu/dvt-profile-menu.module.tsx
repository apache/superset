import { styled } from '@superset-ui/core';

const StyledProfileMenu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 11px;
`;

const StyledProfile = styled.img`
  position: relative;
  display: flex;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  border-radius: 50%;
  width: 48px;
  height: 48px;
`;

const StyledProfileButton = styled.div`
  display: flex;
  cursor: pointer;
`;

export { StyledProfile, StyledProfileButton, StyledProfileMenu };
