/**
 * Represents a type which can release resources, such
 * as event listening or a timer.
 */
export class Disposable {
  /**
   * Combine many disposable-likes into one. You can use this method when having objects with
   * a dispose function which aren't instances of `Disposable`.
   *
   * @param disposableLikes Objects that have at least a `dispose`-function member. Note that asynchronous
   * dispose-functions aren't awaited.
   * @returns Returns a new disposable which, upon dispose, will
   * dispose all provided disposables.
   */
  static from(
    ...disposableLikes: {
      /**
       * Function to clean up resources.
       */
      dispose: () => any;
    }[]
  ): Disposable;

  /**
   * Creates a new disposable that calls the provided function
   * on dispose.
   *
   * *Note* that an asynchronous function is not awaited.
   *
   * @param callOnDispose Function that disposes something.
   */
  constructor(callOnDispose: () => any);

  /**
   * Dispose this object.
   */
  dispose(): any;
}

/**
 * Represents a typed event.
 *
 * A function that represents an event to which you subscribe by calling it with
 * a listener function as argument.
 *
 * @example
 * item.onDidChange(function(event) { console.log("Event happened: " + event); });
 */
export interface Event<T> {
  /**
   * A function that represents an event to which you subscribe by calling it with
   * a listener function as argument.
   *
   * @param listener The listener function will be called when the event happens.
   * @param thisArgs The `this`-argument which will be used when calling the event listener.
   * @param disposables An array to which a {@link Disposable} will be added.
   * @returns A disposable which unsubscribes the event listener.
   */
  (
    listener: (e: T) => any,
    thisArgs?: any,
    disposables?: Disposable[]
  ): Disposable;
}
