const SubMenu = ({ tabs, buttons }: any) => (
  <div data-test="submenu">
    {tabs?.map((tab: any) => (
      <div key={tab.name} role="tab" tabIndex={0} onClick={tab.onClick}>
        {tab.label}
      </div>
    ))}
    {buttons?.map((button: any) => (
      <div key={typeof button.name === 'string' ? button.name : 'button'}>
        {button.name}
      </div>
    ))}
  </div>
);

export default SubMenu;
