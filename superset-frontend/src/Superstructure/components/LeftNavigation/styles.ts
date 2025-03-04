/* eslint-disable theme-colors/no-literal-colors */
import { styled } from '@superset-ui/core';
import { NavLink } from 'react-router-dom';

const LeftNavigationWrapper = styled.section<{ isVisible: boolean }>`
  width: ${({ isVisible }) => (isVisible ? '15%' : '0%')};
  padding: ${({ isVisible }) => (isVisible ? '12px 15px 0 0' : '0')};
  border-right: ${({ isVisible }) =>
    isVisible ? '1px solid #e0e0e0' : 'none'};
  margin-top: 0;
  min-height: 100vh;
  z-index: 0;
`;

const UlContainer = styled.ul`
  line-height: 1.5em;
  list-style: none !important;
  margin-left: 0;
  padding-left: 0;
`;

const ListItem = styled.li`
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 1px;
  border-radius: 4px;
`;

const StyledLink = styled(NavLink)`
  text-decoration: none !important;
  cursor: default;
  display: block;
  padding-left: 7px;
  padding-top: 0.5em;
  padding-bottom: 0.5em;
  color: #69696a;
  border-radius: 2px;

  &:hover {
    background: #f1f1f1;
    color: #69696a;
    cursor: pointer;
    text-decoration: none;
  }
`;

export { LeftNavigationWrapper, UlContainer, ListItem, StyledLink };
