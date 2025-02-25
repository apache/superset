const MenuItem = ({ children, onClick }: any) => (
  <div onClick={onClick} role="menuitem" tabIndex={0}>
    {children}
  </div>
);

export const Menu = ({ children }: any) => <div role="menu">{children}</div>;

Menu.Item = MenuItem;

export default Menu;
