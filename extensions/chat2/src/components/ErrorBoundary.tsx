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
import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Defense-in-depth boundary. The host already wraps the mount in its own
 * ErrorBoundary; this one keeps a panel crash from also bringing down the
 * bubble next to it.
 */
export class ExtensionErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    // eslint-disable-next-line no-console
    console.error('[reference-chatbot] render error', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          data-test="reference-chatbot-error"
          style={{
            padding: 12,
            border: '1px solid #f5222d',
            borderRadius: 6,
            background: '#fff1f0',
            color: '#a8071a',
            fontSize: 12,
            maxWidth: 320,
          }}
        >
          Reference chatbot crashed: {this.state.error.message}
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}
