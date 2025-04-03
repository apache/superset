import React, { useEffect } from 'react';
import { core, sqlLab } from '@apache-superset/types';

const Example: React.FC = () => {
  const [database, setDatabase] = React.useState<core.Database | null>(null);
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
    const tabStateChanged = sqlLab.onDidChangeTabState((tab: sqlLab.Tab) => {
      const { editor } = tab;
      const { database } = editor;
      setDatabase(database);
    });
    return () => {
      queryRun.dispose();
      queryFail.dispose();
      tabStateChanged.dispose();
    };
  }, []);

  return (
    <div style={containerStyle}>
      I'm an extension that shows a log of successful and failed queries.
      <br />
      <div>
        {database
          ? `Database: ${database.id} - ${database.name}`
          : 'No database selected'}
      </div>
      <br />
      <ul>
        {logs.map(log => (
          <li>{log}</li>
        ))}
      </ul>
    </div>
  );
};

export default Example;
