import _ = require("../index");
declare module "../index" {
    // chain

    interface LoDashStatic {
        /**
         * Creates a lodash object that wraps value with explicit method chaining enabled.
         *
         * @param value The value to wrap.
         * @return Returns the new lodash wrapper instance.
         */
        chain<T>(value: T): LoDashExplicitWrapper<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.chain
         */
        chain(): LoDashExplicitWrapper<TValue>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.chain
         */
        chain(): this;
    }

    // prototype.chain

    interface LoDashStatic {
        /**
         * Creates a lodash object that wraps value with explicit method chaining enabled.
         *
         * @param value The value to wrap.
         * @return Returns the new lodash wrapper instance.
         */
        chain<T>(value: T): LoDashExplicitWrapper<T>;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.chain
         */
        chain(): LoDashExplicitWrapper<TValue>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.chain
         */
        chain(): this;
    }

    // prototype.commit

    interface LoDashWrapper<TValue> {
        /**
         * Executes the chained sequence and returns the wrapped result.
         *
         * @return Returns the new lodash wrapper instance.
         */
        commit(): this;
    }

    // prototype.plant

    interface LoDashImplicitWrapper<TValue> {
        /**
         * Creates a clone of the chained sequence planting value as the wrapped value.
         * @param value The value to plant as the wrapped value.
         * @return Returns the new lodash wrapper instance.
         */
        plant<T>(value: T): LoDashImplicitWrapper<T>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.plant
         */
        plant<T>(value: T): LoDashExplicitWrapper<T>;
    }

    // prototype.reverse

    interface LoDashWrapper<TValue> {
        /**
         * Reverses the wrapped array so the first element becomes the last, the second element becomes the second to
         * last, and so on.
         *
         * Note: This method mutates the wrapped array.
         *
         * @return Returns the new reversed lodash wrapper instance.
         */
        reverse(): this;
    }

    // prototype.toJSON

    interface LoDashWrapper<TValue> {
        /**
         * @see _.value
         */
        toJSON(): TValue;
    }

    // prototype.toString

    interface LoDashWrapper<TValue> {
        /**
         * Produces the result of coercing the unwrapped value to a string.
         *
         * @return Returns the coerced string value.
         */
        toString(): string;
    }

    // prototype.value

    interface LoDashWrapper<TValue> {
        /**
         * Executes the chained sequence to extract the unwrapped value.
         *
         * @alias _.toJSON, _.valueOf
         *
         * @return Returns the resolved unwrapped value.
         */
        value(): TValue;
    }

    // prototype.valueOf

    interface LoDashWrapper<TValue> {
        /**
         * @see _.value
         */
        valueOf(): TValue;
    }

    // tap

    interface LoDashStatic {
        /**
         * This method invokes interceptor and returns value. The interceptor is invoked with one
         * argument; (value). The purpose of this method is to "tap into" a method chain in order to perform operations
         * on intermediate results within the chain.
         *
         * @param value The value to provide to interceptor.
         * @param interceptor The function to invoke.
         * @return Returns value.
         **/
        tap<T>(
            value: T,
            interceptor: (value: T) => void
        ): T;
    }

    interface LoDashWrapper<TValue> {
        /**
         * @see _.tap
         */
        tap(
            interceptor: (value: TValue) => void
        ): this;
    }

    // thru

    interface LoDashStatic {
        /**
         * This method is like _.tap except that it returns the result of interceptor.
         *
         * @param value The value to provide to interceptor.
         * @param interceptor The function to invoke.
         * @return Returns the result of interceptor.
         */
        thru<T, TResult>(
            value: T,
            interceptor: (value: T) => TResult
        ): TResult;
    }

    interface LoDashImplicitWrapper<TValue> {
        /**
         * @see _.thru
         */
        thru<TResult>(interceptor: (value: TValue) => TResult): LoDashImplicitWrapper<TResult>;
    }

    interface LoDashExplicitWrapper<TValue> {
        /**
         * @see _.thru
         */
        thru<TResult>(interceptor: (value: TValue) => TResult): LoDashExplicitWrapper<TResult>;
    }
}
