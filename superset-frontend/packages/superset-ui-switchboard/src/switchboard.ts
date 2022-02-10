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

/**
 * A utility for communications between an iframe and its parent, used with embedded Superset.
 * This builds useful patterns on top of the basic functionality offered by MessageChannel.
 *
 * You instantiate a Switchboard in both windows, passing in their corresponding MessagePorts.
 * Calling methods on the switchboard causes messages to be sent through the channel.
 */
export class Switchboard {
  port: MessagePort;
  name: string;
  methods: Record<string, Method<any, any>> = {};
  // used to make unique ids
  incrementor = 1;

  constructor(port: MessagePort, name = 'superset-comms') {
    this.port = port;
    this.name = name;

    port.addEventListener('message', async event => {
      this._log('message received', event);
      const message = event.data;
      if (isGet(message)) {
        const { method, messageId, args } = message;
        // find the method, call it, and reply with the result
        const executor = this.methods[method];
        const result = await executor(args);
        const reply: ReplyMessage = {
          switchboardAction: Actions.REPLY,
          messageId,
          result,
        };
        this.port.postMessage(reply);
      } else if (isEmit(message)) {
        const { method, args } = message;
        // find the method and call it
        // should this multicast? Maybe
        const executor = this.methods[method];
        executor(args);
      }
    });
  }

  /**
   * Defines a method that can be "called" from the other side by sending an event.
   */
  defineMethod<A = any, R = any>(name: string, executor: Method<A, R>) {
    this.methods[name] = executor;
  }

  /**
   * Starts receiving events. Incoming events will be stored in a queue until this is called.
   */
  start() {
    this.port.start();
  }

  /**
   * Calls a method registered on the other side, and returns the result.
   *
   * How this is accomplished:
   * This switchboard sends a "get" message over the channel describing what method to call with optional arguments.
   * The other side's switchboard finds a method with that name, and calls it with the arguments.
   * It then packages up the returned value into a second "reply" message, and sends it back to us across the channel.
   * This switchboard has attached a listener on the channel, which will resolve the promise when the reply is detected.
   *
   * @param method the name of the method to call
   * @param args arguments that will be supplied. Must be serializable.
   * @returns whatever is returned from the method
   */
  get<T = unknown>(method: string, args: unknown = undefined): Promise<T> {
    return new Promise(resolve => {
      // In order to "call a method" on the other side of the port,
      // we will send a message with a unique id
      const messageId = this._getNewMessageId();
      // attach a new listener to our port, and remove it when we get a response
      const listener = (event: MessageEvent) => {
        if (isReply(event.data) && event.data.messageId === messageId) {
          this.port.removeEventListener('message', listener);
          resolve(event.data.result);
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
    const message: EmitMessage = {
      switchboardAction: Actions.EMIT,
      method,
      args,
    };
    this.port.postMessage(message);
  }

  _log(...args: unknown[]) {
    console.debug(`[${this.name}]`, ...args);
  }

  _getNewMessageId() {
    return `m_${this.name}_${this.incrementor++}`;
  }
}

type Method<A extends {}, R> = (args: A) => R;

// Each message we send on the channel specifies an action we want the other side to perform.
enum Actions {
  GET = 'get',
  REPLY = 'reply',
  EMIT = 'emit',
}

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
