// Type definitions for d3JS cloud layout plugin by Jason Davies v1.2.5
// Project: https://github.com/jasondavies/d3-cloud
// Definitions by: hans windhoff <https://github.com/hansrwindhoff>, locknono <https://github.com/locknono>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

import * as d3 from 'd3';

export = d3.layout.cloud;

declare module 'd3' {
    namespace layout {
        export function cloud(): Cloud<cloud.Word>;
        export function cloud<T extends cloud.Word>(): Cloud<T>;

        namespace cloud {
            interface Word {
                text?: string;
                font?: string;
                style?: string;
                weight?: string | number;
                rotate?: number;
                size?: number;
                padding?: number;
                x?: number;
                y?: number;
            }
        }

        interface Cloud<T extends cloud.Word> {
            start(): Cloud<T>;
            stop(): Cloud<T>;

            timeInterval(): number;
            timeInterval(interval: number): Cloud<T>;

            words(): T[];
            words(words: T[]): Cloud<T>;

            size(): [number, number];
            size(size: [number, number]): Cloud<T>;

            font(): (datum: T, index: number) => string;
            font(font: string): Cloud<T>;
            font(font: (datum: T, index: number) => string): Cloud<T>;

            fontStyle(): (datum: T, index: number) => string;
            fontStyle(style: string): Cloud<T>;
            fontStyle(style: (datum: T, index: number) => string): Cloud<T>;

            fontWeight(): (datum: T, index: number) => string | number;
            fontWeight(weight: string | number): Cloud<T>;
            fontWeight(weight: (datum: T, index: number) => string | number): Cloud<T>;

            rotate(): (datum: T, index: number) => number;
            rotate(rotate: number): Cloud<T>;
            rotate(rotate: (datum: T, index: number) => number): Cloud<T>;

            text(): (datum: T, index: number) => string;
            text(text: string): Cloud<T>;
            text(text: (datum: T, index: number) => string): Cloud<T>;

            spiral(): (size: [number, number]) => (t: number) => [number, number];
            spiral(name: string): Cloud<T>;
            spiral(spiral: (size: [number, number]) => (t: number) => [number, number]): Cloud<T>;

            fontSize(): (datum: T, index: number) => number;
            fontSize(size: number): Cloud<T>;
            fontSize(size: (datum: T, index: number) => number): Cloud<T>;

            padding(): (datum: T, index: number) => number;
            padding(padding: number): Cloud<T>;
            padding(padding: (datum: T, index: number) => number): Cloud<T>;

            /**
             * If specified, sets the internal random number generator,used for selecting the initial position of each word,
             * and the clockwise/counterclockwise direction of the spiral for each word.
             *
             * @param randomFunction should return a number in the range [0, 1).The default is Math.random.
             */
            random(): Cloud<T>;
            random(randomFunction: () => number): Cloud<T>;

            /**
             * If specified, sets the canvas generator function, which is used internally to draw text.
             * When using Node.js, you will almost definitely override the default, e.g. using the canvas module.
             * @param canvasGenerator should return a HTMLCanvasElement.The default is:  ()=>{document.createElement("canvas");}
             *
             */
            canvas(): Cloud<T>;
            canvas(canvasGenerator: () => HTMLCanvasElement): Cloud<T>;

            on(type: 'word', listener: (word: T) => void): Cloud<T>;
            on(type: 'end', listener: (tags: T[], bounds: { x: number; y: number }[]) => void): Cloud<T>;
            on(type: string, listener: (...args: any[]) => void): Cloud<T>;

            on(type: 'word'): (word: T) => void;
            on(type: 'end'): (tags: T[], bounds: { x: number; y: number }[]) => void;
            on(type: string): (...args: any[]) => void;
        }
    }
}
