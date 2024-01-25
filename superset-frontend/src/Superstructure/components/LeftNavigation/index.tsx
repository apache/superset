import { hot } from 'react-hot-loader/root';
import React from 'react';
import { RoutesConfig, StylesConfig } from '../../types/global';
import {
  LeftNavigationWrapper,
  UlContainer,
  ListItem,
  StyledLink,
} from './styles';

const LeftNavigation = (props: {
  routesConfig: RoutesConfig;
  baseRoute: string;
  stylesConfig: StylesConfig;
  language: string;
}) => {
  const allAvailableRoutes = props.routesConfig.filter(route => !route.hidden);
  const { businessId } = props.stylesConfig;

  return (
    <LeftNavigationWrapper>
      <UlContainer>
        {allAvailableRoutes.map((route, index) => {
          const link = route.isMainRoute
            ? `${props.baseRoute}Main`
            : `${props.baseRoute}${route.idOrSlug}`;

          return (
            <ListItem key={`${route}-${index}`}>
              <StyledLink
                activeClassName={`active-link active-link-${businessId}`}
                to={link}
              >
                {props.language === 'ru'
                  ? route.nameRU || route.name
                  : route.name}
              </StyledLink>
            </ListItem>
          );
        })}
      </UlContainer>
    </LeftNavigationWrapper>
  );
};

export default hot(LeftNavigation);
