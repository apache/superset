import { styled } from '@superset-ui/core';
import { NavLink } from 'react-router-dom';

const LeftNavigationWrapper = styled.section`
  width: 15%;
  margin-top: -5px;
  min-height: 75vh;
  padding: 0px 20px 0 0;
`;

const UlContainer = styled.ul`
  line-height: 1.5em;
  list-style: none !important;
  margin-left: 0;
  padding-left: 0;
`;

const ListItem = styled.li`
  margin-top: 6px;
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
  padding-top: 0.3em;
  padding-bottom: 0.3em;
  color: #69696a;
  background: #f8f8f8;
  border-radius: 4px;

  &:hover {
    background: #f1f1f1;
    color: #69696a;
    cursor: pointer;
    text-decoration: none;
  }
`;

export { LeftNavigationWrapper, UlContainer, ListItem, StyledLink };
