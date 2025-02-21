import React, {useEffect, useRef, useState} from "react";
import {styled} from "@superset-ui/core";

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
  display: ${(props) => (props.hidden ? "none" : "block")};
`;

const ActionLink = styled.a`
  display: block;
  padding: 5px 12px;
  transition: all 0.3s;
  cursor: pointer;
  text-decoration: none;

  &:hover {
    background-color: #f5f5f5;
    text-decoration: none !important;
  }

  &:focus,
  &:active,
  &:visited {
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

/**
 * Helper function to evaluate the visibility condition.
 * Expects a condition object with properties: column, operator, value.
 */
const evaluateVisibilityCondition = (condition: any, row: any) => {
  if (!condition || !condition.column || !condition.operator) return true;

  const rowValue = row[condition.column[0]];
  const operator = condition.operator;
  const condValue = condition.value;

  switch (operator) {
    case "==":
      return rowValue == condValue;
    case "!=":
      return rowValue != condValue;
    case ">":
      return rowValue > condValue;
    case "<":
      return rowValue < condValue;
    case ">=":
      return rowValue >= condValue;
    case "<=":
      return rowValue <= condValue;
    case "IS NULL":
      return rowValue === null || rowValue === undefined;
    case "IS NOT NULL":
      return rowValue !== null && rowValue !== undefined;
    case "IN": {
      const list = String(condValue)
        .split(",")
        .map((s) => s.trim());
      return list.includes(String(rowValue));
    }
    case "NOT IN": {
      const list = String(condValue)
        .split(",")
        .map((s) => s.trim());
      return !list.includes(String(rowValue));
    }
    default:
      return true;
  }
};

export const ActionCell = ({
                             rowId,
                             actions,
                             row,
                             chartId,
                             idColumn,
                             onActionClick,
                           }: {
  rowId: string;
  actions: any;
  row: any;
  chartId?: any,
  idColumn?: any,
  onActionClick: (actionInfo?: any) => void;
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
    config: any
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const configExtended = config as any;
    const value =  String(row[rowId]);
    onActionClick({
      action: 'table-action',
      chartId: chartId,
      key: configExtended?.key,
      value: value
    });
    setMenuOpen(false);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  return (
    <td className="dt-is-filter right-border-only remita-action-col" width="70px">
      <ActionWrapper ref={wrapperRef} className="remita-action-wrapper">
        <MenuTrigger className="remita-menu-trigger" onClick={toggleMenu}>
          <div className="dot"/>
          <div className="dot"/>
          <div className="dot"/>
        </MenuTrigger>
        <MenuContainer className="remita-menu" hidden={!menuOpen}>
          {actions &&
            Array.from(actions)
              .filter((config: any) => {
                // If there's no visibilityCondition, show the action.
                if (!config.visibilityCondition) return true;
                // Otherwise, evaluate the condition against the row.
                return evaluateVisibilityCondition(config.visibilityCondition, row);
              })
              .map((config: any, index) => (
                <ActionLink
                  key={config?.key || index}
                  href="#"
                  className={`remita-link remita-action-${config?.key || index}`}
                  data-action={config?.action || config?.key || index}
                  onClick={(e) => handleActionClick(e, config)}
                >
                  {config?.label}
                </ActionLink>
              ))}
        </MenuContainer>
      </ActionWrapper>
    </td>
  );
};
