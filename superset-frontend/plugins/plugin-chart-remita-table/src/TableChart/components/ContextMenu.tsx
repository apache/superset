import React from 'react';
import { Dropdown } from '@superset-ui/chart-controls';

interface Props {
  open: boolean;
  anchorStyle: React.CSSProperties;
  items: any[];
  onClick: (info: any) => void;
  onOpenChange: (open: boolean) => void;
}

const ContextMenu: React.FC<Props> = ({ open, anchorStyle, items, onClick, onOpenChange }) => {
  if (!open) return null;
  return (
    <div style={anchorStyle} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}>
      <Dropdown
        open
        menu={{ items, onClick }}
        placement="bottomLeft"
        onOpenChange={onOpenChange}
        trigger={["contextMenu","click"]}
      >
        <span style={{ display: 'inline-block', width: 1, height: 1 }} />
      </Dropdown>
    </div>
  );
};

export default ContextMenu;

