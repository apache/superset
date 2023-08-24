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

export type Params = {
  port: MessagePort;
  name?: string;
  debug?: boolean;
};

// Each message we send on the channel specifies an action we want the other side to cooperate with.
enum Actions {
  GET = 'get',
  REPLY = 'reply',
  EMIT = 'emit',
  ERROR = 'error',
}

type Method<A extends {}, R> = (args: A) => R | Promise<R>;

// helper types/functions for making sure wires don't get crossed

interface Message {
  switchboardAction: Actions;
}

interface GetMessage<T = any> extends Message {
  switchboardAction: Actions.GET;
  method: string;
  messageId: string;
  args: T;
}

function isGet(message: Message): message is GetMessage {
  return message.switchboardAction === Actions.GET;
}

interface ReplyMessage<T = any> extends Message {
  switchboardAction: Actions.REPLY;
  messageId: string;
  result: T;
}

function isReply(message: Message): message is ReplyMessage {
  return message.switchboardAction === Actions.REPLY;
}

interface EmitMessage<T = any> extends Message {
  switchboardAction: Actions.EMIT;
  method: string;
  args: T;
}

function isEmit(message: Message): message is EmitMessage {
  return message.switchboardAction === Actions.EMIT;
}

interface ErrorMessage extends Message {
  switchboardAction: Actions.ERROR;
  messageId: string;
  error: string;
}

function isError(message: Message): message is ErrorMessage {
  return message.switchboardAction === Actions.ERROR;
}

/**
 * A utility for communications between an iframe and its parent, used by the Superset embedded SDK.
 * This builds useful patterns on top of the basic functionality offered by MessageChannel.
 *
 * Both windows instantiate a Switchboard, passing in their MessagePorts.
 * Calling methods on the switchboard causes messages to be sent through the channel.
 */
export class Switchboard {
  port: MessagePort;

  name = '';

  methods: Record<string, Method<any, unknown>> = {};

  // used to make unique ids
  incrementor = 1;

  debugMode: boolean;

  private isInitialised: boolean;

  constructor(params?: Params) {
    if (!params) {
      return;
    }
    this.init(params);
  }

  init(params: Params) {
    if (this.isInitialised) {
      this.logError('already initialized');
      return;
    }

    const { port, name = 'switchboard', debug = false } = params;

    this.port = port;
    this.name = name;
    this.debugMode = debug;

    port.addEventListener('message', async event => {
      this.log('message received', event);
      const message = event.data;
      if (isGet(message)) {
        // find the method, call it, and reply with the result
        this.port.postMessage(await this.getMethodResult(message));
      } else if (isEmit(message)) {
        const { method, args } = message;
        // Find the method and call it, but no result necessary.
        // Should this multicast to a set of listeners?
        // Maybe, but that requires writing a bunch more code
        // and I haven't found a need for it yet.
        const executor = this.methods[method];
        if (executor) {
          executor(args);
        }
      }
    });

    this.isInitialised = true;
  }

  private async getMethodResult({
    messageId,
    method,
    args,
  }: GetMessage): Promise<ReplyMessage | ErrorMessage> {
    const executor = this.methods[method];
    if (executor == null) {
      return <ErrorMessage>{
        switchboardAction: Actions.ERROR,
        messageId,
        error: `[${this.name}] Method "${method}" is not defined`,
      };
    }
    try {
      const result = await executor(args);
      return <ReplyMessage>{
        switchboardAction: Actions.REPLY,
        messageId,
        result,
      };
    } catch (err) {
      this.logError(err);
      return <ErrorMessage>{
        switchboardAction: Actions.ERROR,
        messageId,
        error: `[${this.name}] Method "${method}" threw an error`,
      };
    }
  }

  /**
   * Defines a method that can be "called" from the other side by sending an event.
   */
  defineMethod<A = any, R = any>(methodName: string, executor: Method<A, R>) {
    this.methods[methodName] = executor;
  }

  /**
   * Calls a method registered on the other side, and returns the result.
   *
   * How this is accomplished:
   * This switchboard sends a "get" message over the channel describing which method to call with which arguments.
   * The other side's switchboard finds a method with that name, and calls it with the arguments.
   * It then packages up the returned value into a "reply" message, sending it back to us across the channel.
   * This switchboard has attached a listener on the channel, which will resolve with the result when a reply is detected.
   *
   * Instead of an arguments list, arguments are supplied as a map.
   *
   * @param method the name of the method to call
   * @param args arguments that will be supplied. Must be serializable, no functions or other nonsense.
   * @returns whatever is returned from the method
   */
  get<T = unknown>(method: string, args: unknown = undefined): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialised) {
        reject(new Error('Switchboard not initialised'));
        return;
      }
      // In order to "call a method" on the other side of the port,
      // we will send a message with a unique id
      const messageId = this.getNewMessageId();
      // attach a new listener to our port, and remove it when we get a response
      const listener = (event: MessageEvent) => {
        const message = event.data;
        if (message.messageId !== messageId) return;
        this.port.removeEventListener('message', listener);
        if (isReply(message)) {
          resolve(message.result);
        } else {
          const errStr = isError(message)
            ? message.error
            : 'Unexpected response message';
          reject(new Error(errStr));
        }
      };
      this.port.addEventListener('message', listener);
      this.port.start();
      const message: GetMessage = {
        switchboardAction: Actions.GET,
        method,
        messageId,
        args,
      };
      this.port.postMessage(message);
    });
  }

  /**
   * Emit calls a method on the other side just like get does.
   * But emit doesn't wait for a response, it just sends and forgets.
   *
   * @param method
   * @param args
   */
  emit(method: string, args: unknown = undefined) {
    if (!this.isInitialised) {
      this.logError('Switchboard not initialised');
      return;
    }
    const message: EmitMessage = {
      switchboardAction: Actions.EMIT,
      method,
      args,
    };
    this.port.postMessage(message);
  }

  start() {
    if (!this.isInitialised) {
      this.logError('Switchboard not initialised');
      return;
    }
    this.port.start();
  }

  private log(...args: unknown[]) {
    if (this.debugMode) {
      console.debug(`[${this.name}]`, ...args);
    }
  }

  private logError(...args: unknown[]) {
    console.error(`[${this.name}]`, ...args);
  }

  private getNewMessageId() {
    // eslint-disable-next-line no-plusplus
    return `m_${this.name}_${this.incrementor++}`;
  }
}

export default new Switchboard();
