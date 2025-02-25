export const Dropdown = ({ children, dropdownRender }: any) => (
  <div data-test="dropdown">
    {children}
    {dropdownRender?.()}
  </div>
);

export default Dropdown;
