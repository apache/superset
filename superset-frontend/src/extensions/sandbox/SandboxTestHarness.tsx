/**
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

/**
 * @fileoverview Test harness for sandboxed extensions.
 *
 * This component provides a way to test sandboxed extensions locally
 * without needing the full Superset backend.
 */

import { useCallback, useRef, useState } from 'react';
import { styled } from '@apache-superset/core/ui';
import { SandboxedExtensionRenderer } from './SandboxedExtensionRenderer';
import { SandboxManager } from './SandboxManager';
import { SandboxConfig, SandboxError } from './types';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  gap: 16px;
`;

const Header = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
`;

const SandboxContainer = styled.div`
  flex: 1;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
`;

const LogContainer = styled.div`
  height: 200px;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow-y: auto;
  padding: 8px;
  font-family: monospace;
  font-size: 12px;
  background: #f5f5f5;
`;

const LogEntry = styled.div<{ type: 'info' | 'error' | 'success' }>`
  color: ${({ type }) => {
    switch (type) {
      case 'error':
        return '#d32f2f';
      case 'success':
        return '#388e3c';
      default:
        return '#333';
    }
  }};
  margin-bottom: 4px;
`;

interface LogItem {
  id: number;
  type: 'info' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

/**
 * Test extension code - a simple parquet export simulation.
 */
const TEST_EXTENSION_CODE = `
  // Simple test extension
  (function() {
    const { superset } = window;

    if (!superset) {
      console.error('Superset API not available');
      return;
    }

    // Register the export command
    superset.commands.register('test.export', async () => {
      console.log('Export command triggered');

      try {
        // Get current SQL Lab tab
        const tab = await superset.sqlLab.getCurrentTab();
        console.log('Current tab:', tab);

        if (!tab) {
          superset.ui.showNotification('No active tab found', 'warning');
          return;
        }

        if (!tab.sql) {
          superset.ui.showNotification('No SQL to export', 'warning');
          return;
        }

        superset.ui.showNotification('Export triggered for: ' + tab.title, 'success');

        // Simulate download
        const csvContent = 'col1,col2\\n1,2\\n3,4';
        superset.utils.downloadFile(btoa(csvContent), 'export.csv');

      } catch (error) {
        console.error('Export error:', error);
        superset.ui.showNotification('Export failed: ' + error.message, 'error');
      }
    });

    // Register a greeting command for testing
    superset.commands.register('test.greet', (name) => {
      superset.ui.showNotification('Hello, ' + (name || 'World') + '!', 'info');
    });

    console.log('Test extension activated');
  })();
`;

/**
 * Test harness for sandboxed extensions.
 */
export function SandboxTestHarness() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isReady, setIsReady] = useState(false);
  const logIdRef = useRef(0);

  const addLog = useCallback(
    (type: 'info' | 'error' | 'success', message: string) => {
      logIdRef.current += 1;
      const newId = logIdRef.current;
      setLogs(current => [
        ...current,
        { id: newId, type, message, timestamp: new Date() },
      ]);
    },
    [],
  );

  const config: SandboxConfig = {
    trustLevel: 'iframe',
    permissions: [
      'sqllab:read',
      'notification:show',
      'download:file',
      'clipboard:write',
    ],
  };

  const handleReady = useCallback(() => {
    setIsReady(true);
    addLog('success', 'Sandbox is ready');
  }, [addLog]);

  const handleError = useCallback(
    (error: SandboxError) => {
      addLog('error', `Sandbox error: ${error.code} - ${error.message}`);
    },
    [addLog],
  );

  const executeCommand = useCallback(
    (command: string, ...args: unknown[]) => {
      addLog('info', `Executing command: ${command}`);
      SandboxManager.getInstance().dispatchCommandToExtension(
        'test-extension',
        command,
        args,
      );
    },
    [addLog],
  );

  return (
    <Container>
      <h2>Sandbox Test Harness</h2>

      <Header>
        <button
          type="button"
          onClick={() => executeCommand('test.export')}
          disabled={!isReady}
        >
          Trigger Export Command
        </button>
        <button
          type="button"
          onClick={() => executeCommand('test.greet', 'Developer')}
          disabled={!isReady}
        >
          Trigger Greet Command
        </button>
        <span>
          Status: <strong>{isReady ? '✓ Ready' : '⏳ Loading...'}</strong>
        </span>
      </Header>

      <SandboxContainer>
        <SandboxedExtensionRenderer
          extensionId="test-extension"
          extensionName="Test Extension"
          config={config}
          inlineContent={`<script>${TEST_EXTENSION_CODE}</script>`}
          onReady={handleReady}
          onError={handleError}
          style={{ width: '100%', height: '100%' }}
        />
      </SandboxContainer>

      <h3>Logs</h3>
      <LogContainer>
        {logs.map(log => (
          <LogEntry key={log.id} type={log.type}>
            [{log.timestamp.toISOString().split('T')[1].slice(0, 8)}] {log.message}
          </LogEntry>
        ))}
        {logs.length === 0 && <span>No logs yet...</span>}
      </LogContainer>
    </Container>
  );
}

export default SandboxTestHarness;
