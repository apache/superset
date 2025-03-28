import React, { useEffect } from 'react';
import { sqlLab } from '@apache-superset/types';

const Example: React.FC = () => {
  const [logs, setLogs] = React.useState<string[]>([]);

  const containerStyle: React.CSSProperties = {
    minHeight: '300px',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
  };

  useEffect(() => {
    const queryRun = sqlLab.onDidQueryRun((sql: string) =>
      setLogs(prevLogs => [...prevLogs, sql]),
    );
    const queryFail = sqlLab.onDidQueryFail((error: string) =>
      setLogs(prevLogs => [...prevLogs, error]),
    );
    return () => {
      queryRun.dispose();
      queryFail.dispose();
    };
  }, []);

  return (
    <div style={containerStyle}>
      I'm an extension that shows a log of successful queries and error
      messages.
      <ul>
        {logs.map(log => (
          <li>{log}</li>
        ))}
      </ul>
    </div>
  );
};

export default Example;
