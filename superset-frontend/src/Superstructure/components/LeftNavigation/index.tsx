import { hot } from 'react-hot-loader/root';
import { StylesConfig } from '../../types/global';
import {
  LeftNavigationWrapper,
  ListItem,
  StyledLink,
  UlContainer,
} from './styles';

const LeftNavigation = (props: {
  routes: Array<{
    idOrSlug: null | string | number;
    hidden?: boolean;
    name: string;
    nameRU: string;
  }>;
  baseRoute: string;
  stylesConfig: StylesConfig;
  language: string;
  isVisible: boolean;
  // onNavigate?: () => void;
}) => {
  const allAvailableRoutes = props.routes.filter(route => !route.hidden);
  const { isVisible } = props;
  const { businessId } = props.stylesConfig;

  return (
    <LeftNavigationWrapper isVisible={isVisible}>
      {isVisible && (
        <UlContainer>
          {allAvailableRoutes.map((route, index) => {
            const link = `${props.baseRoute}${route.idOrSlug}`;

            return (
              <ListItem key={`${route}-${index}`}>
                <StyledLink
                  activeClassName={`active-link active-link-${businessId}`}
                  to={link}
                  // onClick={onNavigate}
                >
                  {props.language === 'ru'
                    ? route.nameRU || route.name
                    : route.name}
                </StyledLink>
              </ListItem>
            );
          })}
        </UlContainer>
      )}
    </LeftNavigationWrapper>
  );
};

export default hot(LeftNavigation);
