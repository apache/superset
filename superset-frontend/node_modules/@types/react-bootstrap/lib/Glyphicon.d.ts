import * as React from 'react';

declare namespace Glyphicon {
    export interface GlyphiconProps extends React.HTMLProps<Glyphicon> {
        // Required
        glyph: string;
        // Optional
        bsClass?: string;
    }
}
declare class Glyphicon extends React.Component<Glyphicon.GlyphiconProps> { }
export = Glyphicon;
