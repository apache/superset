declare module "potpack" {
    declare type Bin = {
        x: number,
        y: number,
        w: number,
        h: number
    };

    declare function potpack(bins: Array<Bin>): {w: number, h: number, fill: number};

    declare module.exports: typeof potpack;
}
