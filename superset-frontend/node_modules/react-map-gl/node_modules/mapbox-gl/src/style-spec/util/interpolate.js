// @flow

import Color from './color';

export function number(a: number, b: number, t: number) {
    return (a * (1 - t)) + (b * t);
}

export function color(from: Color, to: Color, t: number) {
    return new Color(
        number(from.r, to.r, t),
        number(from.g, to.g, t),
        number(from.b, to.b, t),
        number(from.a, to.a, t)
    );
}

export function array(from: Array<number>, to: Array<number>, t: number): Array<number> {
    return from.map((d, i) => {
        return number(d, to[i], t);
    });
}
