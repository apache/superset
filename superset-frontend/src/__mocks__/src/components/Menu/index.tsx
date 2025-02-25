import { Children, ReactNode, cloneElement, isValidElement } from 'react';

interface MenuProps {
  children: ReactNode;
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
}

const MenuItem = ({ children, onClick }: MenuItemProps) => (
  <div data-test="menu-item" role="menuitem" onClick={onClick} tabIndex={0}>
    {children}
  </div>
);

const Menu = ({ children }: MenuProps) => (
  <div data-test="menu">
    {Children.map(children, child => {
      if (isValidElement<MenuItemProps>(child) && child.type === MenuItem) {
        return cloneElement<MenuItemProps>(child, {
          onClick: async () => {
            await child.props.onClick?.();
          },
        });
      }
      return child;
    })}
  </div>
);

Menu.Item = MenuItem;

export { Menu };
