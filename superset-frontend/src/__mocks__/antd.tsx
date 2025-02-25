import React from 'react';

// Mock Menu component
const Menu = ({ children, ...props }: any) => (
  <div data-test="antd-menu" {...props}>
    {children}
  </div>
);

Menu.Item = ({ children, ...props }: any) => (
  <div data-test="antd-menu-item" {...props}>
    {children}
  </div>
);

// Add emotion styled support for Menu.Item
const MenuItemComponent = Menu.Item as any;
MenuItemComponent.__emotion_real = MenuItemComponent;
MenuItemComponent.__emotion_base = 'div';
MenuItemComponent.__emotion_styles = [];
MenuItemComponent.withComponent = (nextTag: string) => MenuItemComponent;

export { Menu };