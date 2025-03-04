import { styled } from '@superset-ui/core';

interface DashboardComponentWrapperProps {
  withNavigation?: boolean;
}

interface RootComponentWrapperProps {
  withNavigation?: boolean;
}

export const RootComponentWrapper = styled.section<RootComponentWrapperProps>`
  display: flex;
  flex-direction: row;
  padding-left: ${({ withNavigation }) => (withNavigation ? '15px' : '0')};
`;

export const DashboardComponentWrapper = styled.section<DashboardComponentWrapperProps>`
  width: ${({ withNavigation }) => (withNavigation ? '85%' : '100%')};
`;

// eslint-disable-next-line theme-colors/no-literal-colors
export const ContentWrapper = styled.div`
  min-height: 100vh;
  position: relative;
  background: #fff;
`;
