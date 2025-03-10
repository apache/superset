import React from 'react';
import { Avatar } from '@apache-superset/primitives';
import { commands } from '@apache-superset/types';

const ExtensionExample: React.FC = () => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    minHeight: '300px',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    gap: '20px',
  };

  return (
    <div style={containerStyle}>
      <div>
        <Avatar
          onClick={() => commands.registerCommand('my_command', () => {})}
        >
          M
        </Avatar>
      </div>
      <div>This avatar was imported from Superset!</div>
    </div>
  );
};

export default ExtensionExample;
