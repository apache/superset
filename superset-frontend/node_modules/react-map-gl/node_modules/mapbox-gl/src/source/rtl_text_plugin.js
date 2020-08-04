// @flow

import { Event, Evented } from '../util/evented';
import browser from '../util/browser';

let pluginRequested = false;
let pluginURL = null;
let foregroundLoadComplete = false;

export const evented = new Evented();

type CompletionCallback = (error?: Error) => void;
type ErrorCallback = (error: Error) => void;

let _completionCallback;

export const registerForPluginAvailability = function(
    callback: (args: {pluginURL: string, completionCallback: CompletionCallback}) => void
) {
    if (pluginURL) {
        callback({ pluginURL, completionCallback: _completionCallback});
    } else {
        evented.once('pluginAvailable', callback);
    }
    return callback;
};

export const clearRTLTextPlugin = function() {
    pluginRequested = false;
    pluginURL = null;
};

export const setRTLTextPlugin = function(url: string, callback: ErrorCallback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    pluginURL = browser.resolveURL(url);
    _completionCallback = (error?: Error) => {
        if (error) {
            // Clear loaded state to allow retries
            clearRTLTextPlugin();
            if (callback) {
                callback(error);
            }
        } else {
            // Called once for each worker
            foregroundLoadComplete = true;
        }
    };
    evented.fire(new Event('pluginAvailable', { pluginURL, completionCallback: _completionCallback }));
};

export const plugin: {
    applyArabicShaping: ?Function,
    processBidirectionalText: ?(string, Array<number>) => Array<string>,
    processStyledBidirectionalText: ?(string, Array<number>, Array<number>) => Array<[string, Array<number>]>,
    isLoaded: () => boolean
} = {
    applyArabicShaping: null,
    processBidirectionalText: null,
    processStyledBidirectionalText: null,
    isLoaded() {
        return foregroundLoadComplete ||       // Foreground: loaded if the completion callback returned successfully
            plugin.applyArabicShaping != null; // Background: loaded if the plugin functions have been compiled
    }
};
