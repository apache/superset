import { Disposable } from './core';

/**
 * Namespace for dealing with commands. In short, a command is a function with a
 * unique identifier. The function is sometimes also called _command handler_.
 *
 * Commands can be added using the {@link commands.registerCommand registerCommand}
 * function. Commands can be executed {@link commands.executeCommand manually} or from a UI gesture.
 *
 * Commands from other extensions and from the editor itself are accessible to an extension. However,
 * when invoking an editor command not all argument types are supported.
 *
 * This is a sample that registers a command handler and adds an entry for that command to the palette. First
 * register a command handler with the identifier `extension.sayHello`.
 * ```javascript
 * commands.registerCommand('extension.sayHello', () => {
 * 	window.showInformationMessage('Hello World!');
 * });
 * ```
 */
export namespace commands {
  /**
   * Registers a command that can be invoked via a keyboard shortcut,
   * a menu item, an action, or directly.
   *
   * Registering a command with an existing command identifier twice
   * will cause an error.
   *
   * @param command A unique identifier for the command.
   * @param callback A command handler function.
   * @param thisArg The `this` context used when invoking the handler function.
   * @returns Disposable which unregisters this command on disposal.
   */
  export function registerCommand(
    command: string,
    callback: (...args: any[]) => any,
    thisArg?: any,
  ): Disposable;

  /**
   * Executes the command denoted by the given command identifier.
   *
   * @param command Identifier of the command to execute.
   * @param rest Parameters passed to the command function.
   * @returns A promise that resolves to the returned value of the given command. Returns `undefined` when
   * the command handler function doesn't return anything.
   */
  export function executeCommand<T = unknown>(
    command: string,
    ...rest: any[]
  ): Promise<T>;

  /**
   * Retrieve the list of all available commands. Commands starting with an underscore are
   * treated as internal commands.
   *
   * @param filterInternal Set `true` to not see internal commands (starting with an underscore)
   * @returns Promise that resolves to a list of command ids.
   */
  export function getCommands(filterInternal?: boolean): Promise<string[]>;
}
