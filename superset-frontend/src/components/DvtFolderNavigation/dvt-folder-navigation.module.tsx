import { styled } from '@superset-ui/core';
import { Link } from 'react-router-dom';

const StyledDvtFolderNavigation = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  flex-direction: column;
  gap: 16px;
`;

const DvtFolderNavigationHeader = styled(Link)`
  display: flex;
  gap: 10px;
  align-items: center;
  cursor: pointer;
`;

const DvtFolderNavigationHeaderTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
`;

const DvtFolderNavigationAnimatedIcon = styled.div<FadeInIconProps>`
  margin-left: 12px;
  transition: all 300ms;
  transform: ${({ $fadeIn }) => ($fadeIn ? 'rotate(90deg)' : 'rotate(0)')};
`;

interface FadeInIconProps {
  $fadeIn: boolean;
}

const DvtFolderMiniNavigation = styled.div``;

const DvtFolderNavigationItemsBadge = styled.div`
  display: flex;
  height: 12px;
  width: 12px;
  border-radius: 10px;
  background-color: ${({ theme }) => theme.colors.dvt.primary.base};
`;

export {
  StyledDvtFolderNavigation,
  DvtFolderNavigationHeader,
  DvtFolderNavigationHeaderTitle,
  DvtFolderNavigationAnimatedIcon,
  DvtFolderNavigationItemsBadge,
  DvtFolderMiniNavigation,
};
