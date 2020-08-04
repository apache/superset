// @flow

import config from './config';

import browser from './browser';
import webpSupported from './webp_supported';
import window from './window';
import { version } from '../../package.json';
import { uuid, validateUuid, storageAvailable, b64DecodeUnicode, b64EncodeUnicode, warnOnce, extend } from './util';
import { postData } from './ajax';

import type { RequestParameters } from './ajax';
import type { Cancelable } from '../types/cancelable';
import type {TileJSON} from '../types/tilejson';

const help = 'See https://www.mapbox.com/api-documentation/#access-tokens-and-token-scopes';
const telemEventKey = 'mapbox.eventData';

type UrlObject = {|
    protocol: string,
    authority: string,
    path: string,
    params: Array<string>
|};

function makeAPIURL(urlObject: UrlObject, accessToken: string | null | void): string {
    const apiUrlObject = parseUrl(config.API_URL);
    urlObject.protocol = apiUrlObject.protocol;
    urlObject.authority = apiUrlObject.authority;

    if (apiUrlObject.path !== '/') {
        urlObject.path = `${apiUrlObject.path}${urlObject.path}`;
    }

    if (!config.REQUIRE_ACCESS_TOKEN) return formatUrl(urlObject);

    accessToken = accessToken || config.ACCESS_TOKEN;
    if (!accessToken)
        throw new Error(`An API access token is required to use Mapbox GL. ${help}`);
    if (accessToken[0] === 's')
        throw new Error(`Use a public access token (pk.*) with Mapbox GL, not a secret access token (sk.*). ${help}`);

    urlObject.params.push(`access_token=${accessToken}`);
    return formatUrl(urlObject);
}

function isMapboxURL(url: string) {
    return url.indexOf('mapbox:') === 0;
}

const mapboxHTTPURLRe = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/|\?|$)/i;
function isMapboxHTTPURL(url: string): boolean {
    return mapboxHTTPURLRe.test(url);
}

export { isMapboxURL, isMapboxHTTPURL };

export const normalizeStyleURL = function(url: string, accessToken?: string): string {
    if (!isMapboxURL(url)) return url;
    const urlObject = parseUrl(url);
    urlObject.path = `/styles/v1${urlObject.path}`;
    return makeAPIURL(urlObject, accessToken);
};

export const normalizeGlyphsURL = function(url: string, accessToken?: string): string {
    if (!isMapboxURL(url)) return url;
    const urlObject = parseUrl(url);
    urlObject.path = `/fonts/v1${urlObject.path}`;
    return makeAPIURL(urlObject, accessToken);
};

export const normalizeSourceURL = function(url: string, accessToken?: string): string {
    if (!isMapboxURL(url)) return url;
    const urlObject = parseUrl(url);
    urlObject.path = `/v4/${urlObject.authority}.json`;
    // TileJSON requests need a secure flag appended to their URLs so
    // that the server knows to send SSL-ified resource references.
    urlObject.params.push('secure');
    return makeAPIURL(urlObject, accessToken);
};

export const normalizeSpriteURL = function(url: string, format: string, extension: string, accessToken?: string): string {
    const urlObject = parseUrl(url);
    if (!isMapboxURL(url)) {
        urlObject.path += `${format}${extension}`;
        return formatUrl(urlObject);
    }
    urlObject.path = `/styles/v1${urlObject.path}/sprite${format}${extension}`;
    return makeAPIURL(urlObject, accessToken);
};

const imageExtensionRe = /(\.(png|jpg)\d*)(?=$)/;
// matches any file extension specified by a dot and one or more alphanumeric characters
const extensionRe = /\.[\w]+$/;

export const normalizeTileURL = function(tileURL: string, sourceURL?: ?string, tileSize?: ?number): string {
    if (!sourceURL || !isMapboxURL(sourceURL)) return tileURL;

    const urlObject = parseUrl(tileURL);

    // The v4 mapbox tile API supports 512x512 image tiles only when @2x
    // is appended to the tile URL. If `tileSize: 512` is specified for
    // a Mapbox raster source force the @2x suffix even if a non hidpi device.
    const suffix = browser.devicePixelRatio >= 2 || tileSize === 512 ? '@2x' : '';
    const extension = webpSupported.supported ? '.webp' : '$1';
    urlObject.path = urlObject.path.replace(imageExtensionRe, `${suffix}${extension}`);
    urlObject.path = `/v4${urlObject.path}`;

    return makeAPIURL(urlObject);
};

export const canonicalizeTileURL = function(url: string) {
    const version = "/v4/";

    const urlObject = parseUrl(url);
    // Make sure that we are dealing with a valid Mapbox tile URL.
    // Has to begin with /v4/, with a valid filename + extension
    if (!urlObject.path.match(/(^\/v4\/)/) || !urlObject.path.match(extensionRe)) {
        // Not a proper Mapbox tile URL.
        return url;
    }
    // Reassemble the canonical URL from the parts we've parsed before.
    let result = "mapbox://tiles/";
    result +=  urlObject.path.replace(version, '');

    // Append the query string, minus the access token parameter.
    const params = urlObject.params.filter(p => !p.match(/^access_token=/));
    if (params.length) result += `?${params.join('&')}`;
    return result;
};

export const canonicalizeTileset = function(tileJSON: TileJSON, sourceURL: string) {
    if (!isMapboxURL(sourceURL)) return tileJSON.tiles || [];
    const canonical = [];
    for (const url of tileJSON.tiles) {
        const canonicalUrl = canonicalizeTileURL(url);
        canonical.push(canonicalUrl);
    }
    return canonical;
};

const urlRe = /^(\w+):\/\/([^/?]*)(\/[^?]+)?\??(.+)?/;

function parseUrl(url: string): UrlObject {
    const parts = url.match(urlRe);
    if (!parts) {
        throw new Error('Unable to parse URL object');
    }
    return {
        protocol: parts[1],
        authority: parts[2],
        path: parts[3] || '/',
        params: parts[4] ? parts[4].split('&') : []
    };
}

function formatUrl(obj: UrlObject): string {
    const params = obj.params.length ? `?${obj.params.join('&')}` : '';
    return `${obj.protocol}://${obj.authority}${obj.path}${params}`;
}

function parseAccessToken(accessToken: ?string) {
    if (!accessToken) {
        return null;
    }

    const parts = accessToken.split('.');
    if (!parts || parts.length !== 3) {
        return null;
    }

    try {
        const jsonData = JSON.parse(b64DecodeUnicode(parts[1]));
        return jsonData;
    } catch (e) {
        return null;
    }
}

type TelemetryEventType = 'appUserTurnstile' | 'map.load';

class TelemetryEvent {
    eventData: any;
    anonId: ?string;
    queue: Array<any>;
    type: TelemetryEventType;
    pendingRequest: ?Cancelable;

    constructor(type: TelemetryEventType) {
        this.type = type;
        this.anonId = null;
        this.eventData = {};
        this.queue = [];
        this.pendingRequest = null;
    }

    getStorageKey(domain: ?string) {
        const tokenData = parseAccessToken(config.ACCESS_TOKEN);
        let u = '';
        if (tokenData && tokenData['u']) {
            u = b64EncodeUnicode(tokenData['u']);
        } else {
            u = config.ACCESS_TOKEN || '';
        }
        return domain ?
            `${telemEventKey}.${domain}:${u}` :
            `${telemEventKey}:${u}`;
    }

    fetchEventData() {
        const isLocalStorageAvailable = storageAvailable('localStorage');
        const storageKey = this.getStorageKey();
        const uuidKey = this.getStorageKey('uuid');

        if (isLocalStorageAvailable) {
            //Retrieve cached data
            try {
                const data = window.localStorage.getItem(storageKey);
                if (data) {
                    this.eventData = JSON.parse(data);
                }

                const uuid = window.localStorage.getItem(uuidKey);
                if (uuid) this.anonId = uuid;
            } catch (e) {
                warnOnce('Unable to read from LocalStorage');
            }
        }
    }

    saveEventData() {
        const isLocalStorageAvailable = storageAvailable('localStorage');
        const storageKey =  this.getStorageKey();
        const uuidKey = this.getStorageKey('uuid');
        if (isLocalStorageAvailable) {
            try {
                window.localStorage.setItem(uuidKey, this.anonId);
                if (Object.keys(this.eventData).length >= 1) {
                    window.localStorage.setItem(storageKey, JSON.stringify(this.eventData));
                }
            } catch (e) {
                warnOnce('Unable to write to LocalStorage');
            }
        }

    }

    processRequests() {}

    /*
    * If any event data should be persisted after the POST request, the callback should modify eventData`
    * to the values that should be saved. For this reason, the callback should be invoked prior to the call
    * to TelemetryEvent#saveData
    */
    postEvent(timestamp: number, additionalPayload: {[string]: any}, callback: (err: ?Error) => void) {
        if (!config.EVENTS_URL) return;
        const eventsUrlObject: UrlObject = parseUrl(config.EVENTS_URL);
        eventsUrlObject.params.push(`access_token=${config.ACCESS_TOKEN || ''}`);
        const payload: Object = {
            event: this.type,
            created: new Date(timestamp).toISOString(),
            sdkIdentifier: 'mapbox-gl-js',
            sdkVersion: version,
            userId: this.anonId
        };

        const finalPayload = additionalPayload ? extend(payload, additionalPayload) : payload;
        const request: RequestParameters = {
            url: formatUrl(eventsUrlObject),
            headers: {
                'Content-Type': 'text/plain' //Skip the pre-flight OPTIONS request
            },
            body: JSON.stringify([finalPayload])
        };

        this.pendingRequest = postData(request, (error) => {
            this.pendingRequest = null;
            callback(error);
            this.saveEventData();
            this.processRequests();
        });
    }

    queueRequest(event: number | {id: number, timestamp: number}) {
        this.queue.push(event);
        this.processRequests();
    }
}

export class MapLoadEvent extends TelemetryEvent {
    +success: {[number]: boolean};

    constructor() {
        super('map.load');
        this.success = {};
    }

    postMapLoadEvent(tileUrls: Array<string>, mapId: number) {
        //Enabled only when Mapbox Access Token is set and a source uses
        // mapbox tiles.
        if (config.EVENTS_URL &&
            config.ACCESS_TOKEN &&
            Array.isArray(tileUrls) &&
            tileUrls.some(url => isMapboxURL(url) || isMapboxHTTPURL(url))) {
            this.queueRequest({id: mapId, timestamp: Date.now()});
        }
    }

    processRequests() {
        if (this.pendingRequest || this.queue.length === 0) return;
        const {id, timestamp} = this.queue.shift();

        // Only one load event should fire per map
        if (id && this.success[id]) return;

        if (!this.anonId) {
            this.fetchEventData();
        }

        if (!validateUuid(this.anonId)) {
            this.anonId = uuid();
        }

        this.postEvent(timestamp, {}, (err) => {
            if (!err) {
                if (id) this.success[id] = true;
            }
        });
    }
}


export class TurnstileEvent extends TelemetryEvent {
    constructor() {
        super('appUserTurnstile');
    }

    postTurnstileEvent(tileUrls: Array<string>) {
        //Enabled only when Mapbox Access Token is set and a source uses
        // mapbox tiles.
        if (config.EVENTS_URL &&
            config.ACCESS_TOKEN &&
            Array.isArray(tileUrls) &&
            tileUrls.some(url => isMapboxURL(url) || isMapboxHTTPURL(url))) {
            this.queueRequest(Date.now());
        }
    }


    processRequests() {
        if (this.pendingRequest || this.queue.length === 0) {
            return;
        }

        if (!this.anonId || !this.eventData.lastSuccess || !this.eventData.tokenU) {
            //Retrieve cached data
            this.fetchEventData();
        }

        const tokenData = parseAccessToken(config.ACCESS_TOKEN);
        const tokenU = tokenData ? tokenData['u'] : config.ACCESS_TOKEN;
        //Reset event data cache if the access token owner changed.
        let dueForEvent = tokenU !== this.eventData.tokenU;

        if (!validateUuid(this.anonId)) {
            this.anonId = uuid();
            dueForEvent = true;
        }

        const nextUpdate = this.queue.shift();
        // Record turnstile event once per calendar day.
        if (this.eventData.lastSuccess) {
            const lastUpdate = new Date(this.eventData.lastSuccess);
            const nextDate = new Date(nextUpdate);
            const daysElapsed = (nextUpdate - this.eventData.lastSuccess) / (24 * 60 * 60 * 1000);
            dueForEvent = dueForEvent || daysElapsed >= 1 || daysElapsed < -1 || lastUpdate.getDate() !== nextDate.getDate();
        } else {
            dueForEvent = true;
        }

        if (!dueForEvent) {
            return this.processRequests();
        }

        this.postEvent(nextUpdate, {"enabled.telemetry": false}, (err) => {
            if (!err) {
                this.eventData.lastSuccess = nextUpdate;
                this.eventData.tokenU = tokenU;
            }
        });
    }
}

const turnstileEvent_ = new TurnstileEvent();
export const postTurnstileEvent = turnstileEvent_.postTurnstileEvent.bind(turnstileEvent_);

const mapLoadEvent_ = new MapLoadEvent();
export const postMapLoadEvent = mapLoadEvent_.postMapLoadEvent.bind(mapLoadEvent_);
