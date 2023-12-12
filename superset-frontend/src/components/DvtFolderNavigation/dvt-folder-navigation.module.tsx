import { styled } from '@superset-ui/core';

const StyledDvtFolderNavigation = styled.div`
  display: inline-flex;
  flex-direction: column;
  gap: 14px;
`;

const DvtFolderNavigationItem = styled.div`
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 10px;
    left: 0;
    transform: translateY(-50%);
    height: 12px;
    width: 12px;
    border-radius: 6px;
  }

  &:nth-of-type(3n + 1)::before {
    background-color: ${({ theme }) => theme.colors.dvt.primary.base};
  }

  &:nth-of-type(3n + 2)::before {
    background-color: ${({ theme }) => theme.colors.dvt.warning.base};
  }

  &:nth-of-type(3n)::before {
    background-color: ${({ theme }) => theme.colors.dvt.success.light1};
  }
`;

const DvtFolderNavigationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding-left: 24px;
  height: 20px;
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

const DvtFolderMiniNavigation = styled.div`
  margin-top: 14px;
`;

export {
  StyledDvtFolderNavigation,
  DvtFolderNavigationItem,
  DvtFolderNavigationHeader,
  DvtFolderNavigationHeaderTitle,
  DvtFolderNavigationAnimatedIcon,
  DvtFolderMiniNavigation,
};
