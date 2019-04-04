// Type definitions for Bowser 1.x
// Project: https://github.com/lancedikson/bowser
// Definitions by: Paulo Cesar <https://github.com/pocesar>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

declare const bowser: bowser.IBowser;
export = bowser;
export as namespace bowser;

declare namespace bowser {
    export interface IBowserPlatform {
        ipad: boolean;
        ipod: boolean;
        iphone: boolean;
        /** If a tablet device is detected, the flag tablet is set instead of mobile. */
        tablet: boolean;
        /** All detected mobile OSes are additionally flagged mobile, unless it's a tablet */
        mobile: boolean;
    }

    export interface IBowserOS {
        mac: boolean;
        /**other than Windows Phone */
        windows: boolean;
        windowsphone: boolean;
        /**other than android, chromeos, webos, tizen, and sailfish */
        linux: boolean;
        chromeos: boolean;
        android: boolean;
        /** also sets one of iphone/ipad/ipod */
        ios: boolean;
        blackberry: boolean;
        firefoxos: boolean;
        /** may also set touchpad */
        webos: boolean;
        bada: boolean;
        tizen: boolean;
        sailfish: boolean;
    }

    export interface IBowserVersions {
        chrome: boolean;
        chromium: boolean;
        firefox: boolean;
        msie: boolean;
        msedge: boolean;
        safari: boolean;
        android: boolean;
        ios: boolean;
        opera: boolean;
        samsungBrowser: boolean;
        phantom: boolean;
        blackberry: boolean;
        webos: boolean;
        silk: boolean;
        bada: boolean;
        tizen: boolean;
        seamonkey: boolean;
        sailfish: boolean;
        ucbrowser: boolean;
        qupzilla: boolean;
        vivaldi: boolean;
        sleipnir: boolean;
        kMeleon: boolean;
        whale: boolean;
    }

    export interface IBowserEngines {
        /** IE <= 11 */
        msie: boolean;
        /**Chrome 0-27, Android <4.4, iOs, BB, etc. */
        webkit: boolean;
        /**Chrome >=28, Android >=4.4, Opera, etc. */
        blink: boolean;
        /**Firefox, etc. */
        gecko: boolean;
        /** IE > 11 */
        msedge: boolean;
    }

    export interface IBowserGrade {
        /** Grade A browser */
        a: boolean;
        /** Grade C browser */
        c: boolean;
        /** Grade X browser */
        x: boolean;
        /** A human readable name for this browser. E.g. 'Chrome', '' */
        name: string;
        /** Version number for the browser. E.g. '32.0' */
        version: string|number;
        /** Name for this operating system. E.g. 'macOS' */
        osname: string;
        /** Version number for this operating system. E.g. '10.12.6' */
        osversion: string|number;
    }

    export interface IBowserDetection extends IBowserGrade, IBowserEngines, IBowserOS, IBowserVersions, IBowserPlatform { }

    export interface IBowserMinVersions {
        // { msie: "11", "firefox": "4" }
        [index: string]: string;
    }

    export interface IBowser extends IBowserDetection {
        (): IBowserDetection;
        test(browserList: string[]): boolean;
        _detect(ua: string): IBowser;
        detect(ua: string): IBowser;
        compareVersions(versions: string[]): number;
        check(minVersions: IBowserMinVersions, strictMode?: boolean|string, ua?: string): Boolean;
        isUnsupportedBrowser(minVersions: IBowserMinVersions, strictMode?: boolean|string, ua?: string): boolean;
    }

}
