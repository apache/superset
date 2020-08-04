// @flow

// Flow can't perfectly type Node-style callbacks yet; it does not have a way to
// express that if the first parameter is null, the second is not, so for the time
// being, both parameters must be optional. Use the following convention when defining
// a callback:
//
//    asyncFunction((error, result) => {
//        if (error) {
//            // handle error
//        } else if (result) {
//            // handle success
//        }
//    });
//
// See https://github.com/facebook/flow/issues/2123 for more.
export type Callback<T> = (error: ?Error, result: ?T) => void;
