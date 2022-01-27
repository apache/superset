export { css, jsx, ThemeProvider, CacheProvider as EmotionCacheProvider, withTheme, } from '@emotion/react';
export { default as createEmotionCache } from '@emotion/cache';
declare module '@emotion/react' {
    interface Theme extends SupersetTheme {
    }
}
export declare function useTheme(): import("@emotion/react").Theme;
export declare const emotionCache: import("@emotion/react").EmotionCache;
export declare const styled: import("@emotion/styled").CreateStyled;
declare const defaultTheme: {
    borderRadius: number;
    colors: {
        text: {
            label: string;
            help: string;
        };
        primary: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
            light3: string;
            light4: string;
            light5: string;
        };
        secondary: {
            base: string;
            dark1: string;
            dark2: string;
            dark3: string;
            light1: string;
            light2: string;
            light3: string;
            light4: string;
            light5: string;
        };
        grayscale: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
            light3: string;
            light4: string;
            light5: string;
        };
        error: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        warning: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        alert: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        success: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        info: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
    };
    opacity: {
        light: string;
        mediumLight: string;
        mediumHeavy: string;
        heavy: string;
    };
    typography: {
        families: {
            sansSerif: string;
            serif: string;
            monospace: string;
        };
        weights: {
            light: number;
            normal: number;
            bold: number;
        };
        sizes: {
            xxs: number;
            xs: number;
            s: number;
            m: number;
            l: number;
            xl: number;
            xxl: number;
        };
    };
    zIndex: {
        aboveDashboardCharts: number;
        dropdown: number;
        max: number;
    };
    transitionTiming: number;
    gridUnit: number;
};
export declare type SupersetTheme = typeof defaultTheme;
export interface SupersetThemeProps {
    theme: SupersetTheme;
}
export declare const supersetTheme: {
    borderRadius: number;
    colors: {
        text: {
            label: string;
            help: string;
        };
        primary: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
            light3: string;
            light4: string;
            light5: string;
        };
        secondary: {
            base: string;
            dark1: string;
            dark2: string;
            dark3: string;
            light1: string;
            light2: string;
            light3: string;
            light4: string;
            light5: string;
        };
        grayscale: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
            light3: string;
            light4: string;
            light5: string;
        };
        error: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        warning: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        alert: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        success: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
        info: {
            base: string;
            dark1: string;
            dark2: string;
            light1: string;
            light2: string;
        };
    };
    opacity: {
        light: string;
        mediumLight: string;
        mediumHeavy: string;
        heavy: string;
    };
    typography: {
        families: {
            sansSerif: string;
            serif: string;
            monospace: string;
        };
        weights: {
            light: number;
            normal: number;
            bold: number;
        };
        sizes: {
            xxs: number;
            xs: number;
            s: number;
            m: number;
            l: number;
            xl: number;
            xxl: number;
        };
    };
    zIndex: {
        aboveDashboardCharts: number;
        dropdown: number;
        max: number;
    };
    transitionTiming: number;
    gridUnit: number;
};
//# sourceMappingURL=index.d.ts.map