import React from 'react';

interface MenuProps {
  children: React.ReactNode;
}

interface MenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
}

const MenuItem = ({ children, onClick }: MenuItemProps) => (
  <div data-test="menu-item" role="menuitem" onClick={onClick}>
    {children}
  </div>
);

const Menu = ({ children }: MenuProps) => (
  <div data-test="menu">
    {React.Children.map(children, child => {
      if (React.isValidElement<MenuItemProps>(child) && child.type === MenuItem) {
        return React.cloneElement<MenuItemProps>(child, {
          onClick: async () => {
            if (child.props.onClick) {
              try {
                await child.props.onClick();
              } catch (error) {
                // Let the error propagate
                throw error;
              }
            }
          },
        });
      }
      return child;
    })}
  </div>
);

Menu.Item = MenuItem;

export { Menu };