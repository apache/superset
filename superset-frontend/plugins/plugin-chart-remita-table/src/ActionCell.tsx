import React, { useEffect, useRef, useState } from "react";
import { styled } from "@superset-ui/core";

const ActionWrapper = styled.div`
  position: relative;
  display: inline-block;
  &.remita-action-wrapper {
    position: relative;
  }
`;

const MenuContainer = styled.div`
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 1050;
  min-width: 120px;
  display: ${props => props.hidden ? 'none' : 'block'};
`;

const ActionLink = styled.a`
  display: block;
  padding: 5px 12px;
  //color: rgba(0, 0, 0, 0.85);
  transition: all 0.3s;
  cursor: pointer;
  text-decoration: none;
  &:hover {
    background-color: #f5f5f5;
    text-decoration: none !important;
  }

  &:focus, &:active, &:visited {
    text-decoration: none !important;
  }
`;

const MenuTrigger = styled.span`
  cursor: pointer;
  padding: 4px 8px;
  display: inline-block;
  user-select: none;
  
  &:hover {
    background-color: #f5f5f5;
    border-radius: 4px;
  }
  .dot {
    display: block;
    height: 4px;
    width: 4px;
    border-radius: 50%;
    margin: 2px 0;
    background-color: #879399;
  }
`;

export const ActionCell = ({
                             rowId,
                             actions,
                             row,
                             onActionClick,
                           }: {
  rowId: string;
  actions: any;
  row: any;
  onActionClick: (action: string, id: string, value?: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleActionClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    key: string,
    config: any
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const configExtended = config as any;
    const value = configExtended.valueColumn ? String(row[configExtended.valueColumn]) : undefined;
    onActionClick(configExtended.action || key, rowId, value);
    setMenuOpen(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  return (
    <td className="dt-is-filter right-border-only remita-action-col" width="70px">
      <ActionWrapper ref={wrapperRef} className="remita-action-wrapper">
        <MenuTrigger
          className="remita-menu-trigger"
          onClick={toggleMenu}
        >
          <div className="dot" />
          <div className="dot" />
          <div className="dot" />
        </MenuTrigger>
        <MenuContainer className="remita-menu" hidden={!menuOpen}>
          {Array.from(actions).map((config:any, index) => (
            <ActionLink
              key={config?.key || index}
              href="#"
              className={`remita-link remita-action-${config?.key || index}`}
              data-action={config?.action || config?.key || index}
              onClick={(e) => handleActionClick(e, config?.key || index, config)}
            >
              {config?.label}
            </ActionLink>
          ))}

        </MenuContainer>
      </ActionWrapper>
    </td>
  );
};
