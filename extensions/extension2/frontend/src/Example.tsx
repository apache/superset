/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// eslint-disable-next-line no-restricted-syntax
import React, { useEffect } from "react";
import { core, sqlLab } from "@apache-superset/core";

const Example: React.FC = () => {
  const [databaseId, setDatabaseId] = React.useState<number | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);

  const containerStyle: React.CSSProperties = {
    minHeight: "300px",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
  };

  useEffect(() => {
    const queryRun = sqlLab.onDidQueryRun((editor: sqlLab.Editor) =>
      setLogs((prevLogs) => [...prevLogs, editor.content])
    );
    const queryFail = sqlLab.onDidQueryFail((error: string) =>
      setLogs((prevLogs) => [...prevLogs, error])
    );
    const onDidChangeEditorDatabase = sqlLab.onDidChangeEditorDatabase(
      (databaseId: number) => setDatabaseId(databaseId)
    );
    return () => {
      queryRun.dispose();
      queryFail.dispose();
      onDidChangeEditorDatabase.dispose();
    };
  }, []);

  return (
    <div style={containerStyle}>
      I'm an extension that shows a log of successful and failed queries.
      <br />
      {databaseId && <div>Database changed to: {databaseId}</div>}
      <br />
      <ul>
        {logs.map((log) => (
          <li>{log}</li>
        ))}
      </ul>
    </div>
  );
};

export default Example;
