import { theme } from '@superset-ui/core';

// Mock Menu component
const Menu = ({ children, ...props }: any) => (
  <div data-test="antd-menu" {...props}>
    {children}
  </div>
);

Menu.Item = ({ children, ...props }: any) => (
  <div data-test="antd-menu-item" role="menuitem" {...props}>
    {children}
  </div>
);

Menu.SubMenu = ({ children, ...props }: any) => (
  <div data-test="antd-menu-submenu" {...props}>
    {children}
  </div>
);

Menu.Divider = ({ children, ...props }: any) => (
  <div data-test="antd-menu-divider" {...props}>
    {children}
  </div>
);

Menu.ItemGroup = ({ children, ...props }: any) => (
  <div data-test="antd-menu-item-group" {...props}>
    {children}
  </div>
);

// Mock Card component
const Card = ({ children, css, ...props }: any) => {
  const style =
    typeof css === 'function'
      ? css({
          colors: { grayscale: { light2: theme.colors.grayscale.light2 } },
          gridUnit: 4,
        })
      : css;
  return (
    <div data-test="antd-card" style={style} {...props}>
      {children}
    </div>
  );
};

Card.Meta = ({ children, ...props }: any) => (
  <div data-test="antd-card-meta" {...props}>
    {children}
  </div>
);

// Mock Input component
const Input = ({ ...props }: any) => (
  <input data-test="antd-input" {...props} />
);

Input.TextArea = ({ children, ...props }: any) => (
  <textarea data-test="antd-input-textarea" {...props}>
    {children}
  </textarea>
);

Input.Password = ({ ...props }: any) => (
  <input type="password" data-test="antd-input-password" {...props} />
);

// Mock Modal component
const Modal = ({ children, ...props }: any) => (
  <div data-test="antd-modal" role="dialog" {...props}>
    {children}
  </div>
);

// Mock Button component
const Button = ({ children, ...props }: any) => (
  <button type="button" data-test="antd-button" {...props}>
    {children}
  </button>
);

// Mock Empty component
const Empty = ({ children, ...props }: any) => (
  <div data-test="antd-empty" {...props}>
    {children}
  </div>
);

Empty.PRESENTED_IMAGE_SIMPLE = 'simple-image';
Empty.PRESENTED_IMAGE_DEFAULT = 'default-image';

// Mock Dropdown component
const Dropdown = ({
  children,
  dropdownRender,
  trigger = ['click'],
  ...props
}: any) => (
  <div data-test="antd-dropdown" {...props}>
    {children}
    {dropdownRender?.()}
  </div>
);

// Mock Tooltip component
const Tooltip = ({ children, title, ...props }: any) => (
  <div data-test="antd-tooltip" {...props}>
    <div data-test="antd-tooltip-title">{title}</div>
    {children}
  </div>
);

// Add emotion styled support
const addEmotionSupport = (Component: any) => {
  const emotionComponent = Component;
  // Using Object.defineProperties to avoid direct assignment
  Object.defineProperties(emotionComponent, {
    withComponent: {
      value: () => emotionComponent,
      writable: true,
    },
  });
  return emotionComponent;
};

[
  Menu,
  Menu.Item,
  Menu.SubMenu,
  Card,
  Card.Meta,
  Input,
  Input.TextArea,
  Input.Password,
  Empty,
  Dropdown,
  Tooltip,
].forEach(addEmotionSupport);

export { Menu, Card, Input, Modal, Button, Empty, Dropdown, Tooltip };
