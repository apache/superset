import { hot } from 'react-hot-loader/root';
import React from 'react';
import { RoutesConfig } from 'src/Superstructure/types/global';
import {
  LeftNavigationWrapper,
  UlContainer,
  ListItem,
  StyledLink,
} from './styles';

const LeftNavigation = (props: {
  routesConfig: RoutesConfig;
  baseRoute: string;
}) => {
  const allAvailableRoutes = props.routesConfig.filter(route => !route.hidden);

  return (
    <LeftNavigationWrapper>
      <UlContainer>
        {Object.keys(allAvailableRoutes).map((keyName, i) => (
          <ListItem key={`${keyName}-${i}`}>
            <StyledLink
              activeClassName="active-link"
              to={`${props.baseRoute}${allAvailableRoutes[keyName].route}`}
            >
              {allAvailableRoutes[keyName].name}
            </StyledLink>
          </ListItem>
        ))}
      </UlContainer>
    </LeftNavigationWrapper>
  );
};

export default hot(LeftNavigation);
