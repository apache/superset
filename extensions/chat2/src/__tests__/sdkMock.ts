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
 * In-memory mock of `@apache-superset/core` for unit-testing the extension.
 *
 * Mirrors only the surfaces the reference chatbot consumes:
 *  - views.registerView returns a disposable that removes the view
 *  - commands.registerCommand / executeCommand round-trip handlers
 *  - sqlLab.getCurrentTab returns undefined (no SQL Lab in tests)
 *
 * The mock is intentionally observable: tests can read `registry.views` and
 * `registry.commands` to assert contract compliance.
 */

import type { ReactElement } from 'react';

type Provider = () => ReactElement;

interface ViewDescriptor {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

interface DisposableLike {
  dispose(): void;
}

interface RegisteredView {
  view: ViewDescriptor;
  location: string;
  provider: Provider;
}

interface RegisteredCommand {
  id: string;
  title: string;
  handler: (...args: any[]) => any;
}

export const registry = {
  views: new Map<string, RegisteredView>(),
  commands: new Map<string, RegisteredCommand>(),
};

export const reset = (): void => {
  registry.views.clear();
  registry.commands.clear();
};

export const views = {
  registerView(
    view: ViewDescriptor,
    location: string,
    provider: Provider,
  ): DisposableLike {
    registry.views.set(view.id, { view, location, provider });
    return {
      dispose: () => {
        registry.views.delete(view.id);
      },
    };
  },
  getViews(location: string) {
    return Array.from(registry.views.values())
      .filter(v => v.location === location)
      .map(v => v.view);
  },
};

export const commands = {
  registerCommand(
    command: { id: string; title: string },
    handler: (...args: any[]) => any,
  ): DisposableLike {
    registry.commands.set(command.id, {
      id: command.id,
      title: command.title,
      handler,
    });
    return {
      dispose: () => {
        registry.commands.delete(command.id);
      },
    };
  },
  async executeCommand(id: string, ...rest: any[]): Promise<unknown> {
    const cmd = registry.commands.get(id);
    return cmd?.handler(...rest);
  },
  getCommands() {
    return Array.from(registry.commands.values()).map(c => ({
      id: c.id,
      title: c.title,
    }));
  },
};

export const sqlLab = {
  getCurrentTab: () => undefined,
};
