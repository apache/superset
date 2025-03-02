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
Object.defineProperties(MenuItemComponent, {
  withComponent: {
    value: () => MenuItemComponent,
    writable: true,
  },
});

export { Menu };
