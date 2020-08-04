// @flow

import {
    charHasUprightVerticalOrientation,
    charAllowsIdeographicBreaking
} from '../util/script_detection';
import verticalizePunctuation from '../util/verticalize_punctuation';
import { plugin as rtlTextPlugin } from '../source/rtl_text_plugin';

import type {StyleGlyph} from '../style/style_glyph';
import type {ImagePosition} from '../render/image_atlas';
import Formatted from '../style-spec/expression/types/formatted';

const WritingMode = {
    horizontal: 1,
    vertical: 2,
    horizontalOnly: 3
};

export { shapeText, shapeIcon, WritingMode };

// The position of a glyph relative to the text's anchor point.
export type PositionedGlyph = {
    glyph: number,
    x: number,
    y: number,
    vertical: boolean,
    scale: number,
    fontStack: string
};

// A collection of positioned glyphs and some metadata
export type Shaping = {
    positionedGlyphs: Array<PositionedGlyph>,
    top: number,
    bottom: number,
    left: number,
    right: number,
    writingMode: 1 | 2
};

type SymbolAnchor = 'center' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type TextJustify = 'left' | 'center' | 'right';

class TaggedString {
    text: string;
    sectionIndex: Array<number> // maps each character in 'text' to its corresponding entry in 'sections'
    sections: Array<{ scale: number, fontStack: string }>

    constructor() {
        this.text = "";
        this.sectionIndex = [];
        this.sections = [];
    }

    static fromFeature(text: Formatted, defaultFontStack: string) {
        const result = new TaggedString();
        for (let i = 0; i < text.sections.length; i++) {
            const section = text.sections[i];
            result.sections.push({
                scale: section.scale || 1,
                fontStack: section.fontStack || defaultFontStack
            });
            result.text += section.text;
            for (let j = 0; j < section.text.length; j++) {
                result.sectionIndex.push(i);
            }
        }
        return result;
    }

    length(): number {
        return this.text.length;
    }

    getSection(index: number): { scale: number, fontStack: string } {
        return this.sections[this.sectionIndex[index]];
    }

    getCharCode(index: number): number {
        return this.text.charCodeAt(index);
    }

    verticalizePunctuation() {
        this.text = verticalizePunctuation(this.text);
    }

    trim() {
        let beginningWhitespace = 0;
        for (let i = 0;
            i < this.text.length && whitespace[this.text.charCodeAt(i)];
            i++) {
            beginningWhitespace++;
        }
        let trailingWhitespace = this.text.length;
        for (let i = this.text.length - 1;
            i >= 0 && i >= beginningWhitespace && whitespace[this.text.charCodeAt(i)];
            i--) {
            trailingWhitespace--;
        }
        this.text = this.text.substring(beginningWhitespace, trailingWhitespace);
        this.sectionIndex = this.sectionIndex.slice(beginningWhitespace, trailingWhitespace);
    }

    substring(start: number, end: number): TaggedString {
        const substring = new TaggedString();
        substring.text = this.text.substring(start, end);
        substring.sectionIndex = this.sectionIndex.slice(start, end);
        substring.sections = this.sections;
        return substring;
    }

    toString(): string {
        return this.text;
    }

    getMaxScale() {
        return this.sectionIndex.reduce((max, index) => Math.max(max, this.sections[index].scale), 0);
    }
}

function breakLines(input: TaggedString, lineBreakPoints: Array<number>): Array<TaggedString> {
    const lines = [];
    const text = input.text;
    let start = 0;
    for (const lineBreak of lineBreakPoints) {
        lines.push(input.substring(start, lineBreak));
        start = lineBreak;
    }

    if (start < text.length) {
        lines.push(input.substring(start, text.length));
    }
    return lines;
}

function shapeText(text: Formatted,
                   glyphs: {[string]: {[number]: ?StyleGlyph}},
                   defaultFontStack: string,
                   maxWidth: number,
                   lineHeight: number,
                   textAnchor: SymbolAnchor,
                   textJustify: TextJustify,
                   spacing: number,
                   translate: [number, number],
                   verticalHeight: number,
                   writingMode: 1 | 2): Shaping | false {
    const logicalInput = TaggedString.fromFeature(text, defaultFontStack);

    if (writingMode === WritingMode.vertical) {
        logicalInput.verticalizePunctuation();
    }

    const positionedGlyphs = [];
    const shaping = {
        positionedGlyphs,
        text: logicalInput,
        top: translate[1],
        bottom: translate[1],
        left: translate[0],
        right: translate[0],
        writingMode
    };

    let lines: Array<TaggedString>;

    const {processBidirectionalText, processStyledBidirectionalText} = rtlTextPlugin;
    if (processBidirectionalText && logicalInput.sections.length === 1) {
        // Bidi doesn't have to be style-aware
        lines = [];
        const untaggedLines =
            processBidirectionalText(logicalInput.toString(),
                                     determineLineBreaks(logicalInput, spacing, maxWidth, glyphs));
        for (const line of untaggedLines) {
            const taggedLine = new TaggedString();
            taggedLine.text = line;
            taggedLine.sections = logicalInput.sections;
            for (let i = 0; i < line.length; i++) {
                taggedLine.sectionIndex.push(0);
            }
            lines.push(taggedLine);
        }
    } else if (processStyledBidirectionalText) {
        // Need version of mapbox-gl-rtl-text with style support for combining RTL text
        // with formatting
        lines = [];
        const processedLines =
            processStyledBidirectionalText(logicalInput.text,
                                           logicalInput.sectionIndex,
                                           determineLineBreaks(logicalInput, spacing, maxWidth, glyphs));
        for (const line of processedLines) {
            const taggedLine = new TaggedString();
            taggedLine.text = line[0];
            taggedLine.sectionIndex = line[1];
            taggedLine.sections = logicalInput.sections;
            lines.push(taggedLine);
        }
    } else {
        lines = breakLines(logicalInput, determineLineBreaks(logicalInput, spacing, maxWidth, glyphs));
    }

    shapeLines(shaping, glyphs, lines, lineHeight, textAnchor, textJustify, writingMode, spacing, verticalHeight);

    if (!positionedGlyphs.length)
        return false;

    shaping.text = shaping.text.toString();
    return shaping;
}

// using computed properties due to https://github.com/facebook/flow/issues/380
/* eslint no-useless-computed-key: 0 */

const whitespace: {[number]: boolean} = {
    [0x09]: true, // tab
    [0x0a]: true, // newline
    [0x0b]: true, // vertical tab
    [0x0c]: true, // form feed
    [0x0d]: true, // carriage return
    [0x20]: true, // space
};

const breakable: {[number]: boolean} = {
    [0x0a]:   true, // newline
    [0x20]:   true, // space
    [0x26]:   true, // ampersand
    [0x28]:   true, // left parenthesis
    [0x29]:   true, // right parenthesis
    [0x2b]:   true, // plus sign
    [0x2d]:   true, // hyphen-minus
    [0x2f]:   true, // solidus
    [0xad]:   true, // soft hyphen
    [0xb7]:   true, // middle dot
    [0x200b]: true, // zero-width space
    [0x2010]: true, // hyphen
    [0x2013]: true, // en dash
    [0x2027]: true  // interpunct
    // Many other characters may be reasonable breakpoints
    // Consider "neutral orientation" characters at scriptDetection.charHasNeutralVerticalOrientation
    // See https://github.com/mapbox/mapbox-gl-js/issues/3658
};

function determineAverageLineWidth(logicalInput: TaggedString,
                                   spacing: number,
                                   maxWidth: number,
                                   glyphMap: {[string]: {[number]: ?StyleGlyph}}) {
    let totalWidth = 0;

    for (let index = 0; index < logicalInput.length(); index++) {
        const section = logicalInput.getSection(index);
        const positions = glyphMap[section.fontStack];
        const glyph = positions && positions[logicalInput.getCharCode(index)];
        if (!glyph)
            continue;
        totalWidth += glyph.metrics.advance * section.scale + spacing;
    }

    const lineCount = Math.max(1, Math.ceil(totalWidth / maxWidth));
    return totalWidth / lineCount;
}

function calculateBadness(lineWidth: number,
                          targetWidth: number,
                          penalty: number,
                          isLastBreak: boolean) {
    const raggedness = Math.pow(lineWidth - targetWidth, 2);
    if (isLastBreak) {
        // Favor finals lines shorter than average over longer than average
        if (lineWidth < targetWidth) {
            return raggedness / 2;
        } else {
            return raggedness * 2;
        }
    }

    return raggedness + Math.abs(penalty) * penalty;
}

function calculatePenalty(codePoint: number, nextCodePoint: number) {
    let penalty = 0;
    // Force break on newline
    if (codePoint === 0x0a) {
        penalty -= 10000;
    }
    // Penalize open parenthesis at end of line
    if (codePoint === 0x28 || codePoint === 0xff08) {
        penalty += 50;
    }

    // Penalize close parenthesis at beginning of line
    if (nextCodePoint === 0x29 || nextCodePoint === 0xff09) {
        penalty += 50;
    }
    return penalty;
}

type Break = {
    index: number,
    x: number,
    priorBreak: ?Break,
    badness: number
};

function evaluateBreak(breakIndex: number,
                       breakX: number,
                       targetWidth: number,
                       potentialBreaks: Array<Break>,
                       penalty: number,
                       isLastBreak: boolean): Break {
    // We could skip evaluating breaks where the line length (breakX - priorBreak.x) > maxWidth
    //  ...but in fact we allow lines longer than maxWidth (if there's no break points)
    //  ...and when targetWidth and maxWidth are close, strictly enforcing maxWidth can give
    //     more lopsided results.

    let bestPriorBreak: ?Break = null;
    let bestBreakBadness = calculateBadness(breakX, targetWidth, penalty, isLastBreak);

    for (const potentialBreak of potentialBreaks) {
        const lineWidth = breakX - potentialBreak.x;
        const breakBadness =
            calculateBadness(lineWidth, targetWidth, penalty, isLastBreak) + potentialBreak.badness;
        if (breakBadness <= bestBreakBadness) {
            bestPriorBreak = potentialBreak;
            bestBreakBadness = breakBadness;
        }
    }

    return {
        index: breakIndex,
        x: breakX,
        priorBreak: bestPriorBreak,
        badness: bestBreakBadness
    };
}

function leastBadBreaks(lastLineBreak: ?Break): Array<number> {
    if (!lastLineBreak) {
        return [];
    }
    return leastBadBreaks(lastLineBreak.priorBreak).concat(lastLineBreak.index);
}

function determineLineBreaks(logicalInput: TaggedString,
                             spacing: number,
                             maxWidth: number,
                             glyphMap: {[string]: {[number]: ?StyleGlyph}}): Array<number> {
    if (!maxWidth)
        return [];

    if (!logicalInput)
        return [];

    const potentialLineBreaks = [];
    const targetWidth = determineAverageLineWidth(logicalInput, spacing, maxWidth, glyphMap);

    let currentX = 0;

    for (let i = 0; i < logicalInput.length(); i++) {
        const section = logicalInput.getSection(i);
        const codePoint = logicalInput.getCharCode(i);
        const positions = glyphMap[section.fontStack];
        const glyph = positions && positions[codePoint];

        if (glyph && !whitespace[codePoint])
            currentX += glyph.metrics.advance * section.scale + spacing;

        // Ideographic characters, spaces, and word-breaking punctuation that often appear without
        // surrounding spaces.
        if ((i < logicalInput.length() - 1) &&
            (breakable[codePoint] ||
                charAllowsIdeographicBreaking(codePoint))) {

            potentialLineBreaks.push(
                evaluateBreak(
                    i + 1,
                    currentX,
                    targetWidth,
                    potentialLineBreaks,
                    calculatePenalty(codePoint, logicalInput.getCharCode(i + 1)),
                    false));
        }
    }

    return leastBadBreaks(
        evaluateBreak(
            logicalInput.length(),
            currentX,
            targetWidth,
            potentialLineBreaks,
            0,
            true));
}

function getAnchorAlignment(anchor: SymbolAnchor) {
    let horizontalAlign = 0.5, verticalAlign = 0.5;

    switch (anchor) {
    case 'right':
    case 'top-right':
    case 'bottom-right':
        horizontalAlign = 1;
        break;
    case 'left':
    case 'top-left':
    case 'bottom-left':
        horizontalAlign = 0;
        break;
    }

    switch (anchor) {
    case 'bottom':
    case 'bottom-right':
    case 'bottom-left':
        verticalAlign = 1;
        break;
    case 'top':
    case 'top-right':
    case 'top-left':
        verticalAlign = 0;
        break;
    }

    return { horizontalAlign, verticalAlign };
}

function shapeLines(shaping: Shaping,
                    glyphMap: {[string]: {[number]: ?StyleGlyph}},
                    lines: Array<TaggedString>,
                    lineHeight: number,
                    textAnchor: SymbolAnchor,
                    textJustify: TextJustify,
                    writingMode: 1 | 2,
                    spacing: number,
                    verticalHeight: number) {
    // the y offset *should* be part of the font metadata
    const yOffset = -17;

    let x = 0;
    let y = yOffset;

    let maxLineLength = 0;
    const positionedGlyphs = shaping.positionedGlyphs;

    const justify =
        textJustify === 'right' ? 1 :
        textJustify === 'left' ? 0 : 0.5;

    for (const line of lines) {
        line.trim();

        const lineMaxScale = line.getMaxScale();

        if (!line.length()) {
            y += lineHeight; // Still need a line feed after empty line
            continue;
        }

        const lineStartIndex = positionedGlyphs.length;
        for (let i = 0; i < line.length(); i++) {
            const section = line.getSection(i);
            const codePoint = line.getCharCode(i);
            // We don't know the baseline, but since we're laying out
            // at 24 points, we can calculate how much it will move when
            // we scale up or down.
            const baselineOffset = (lineMaxScale - section.scale) * 24;
            const positions = glyphMap[section.fontStack];
            const glyph = positions && positions[codePoint];

            if (!glyph) continue;

            if (!charHasUprightVerticalOrientation(codePoint) || writingMode === WritingMode.horizontal) {
                positionedGlyphs.push({glyph: codePoint, x, y: y + baselineOffset, vertical: false, scale: section.scale, fontStack: section.fontStack});
                x += glyph.metrics.advance * section.scale + spacing;
            } else {
                positionedGlyphs.push({glyph: codePoint, x, y: baselineOffset, vertical: true, scale: section.scale, fontStack: section.fontStack});
                x += verticalHeight * section.scale + spacing;
            }
        }

        // Only justify if we placed at least one glyph
        if (positionedGlyphs.length !== lineStartIndex) {
            const lineLength = x - spacing;
            maxLineLength = Math.max(lineLength, maxLineLength);

            justifyLine(positionedGlyphs, glyphMap, lineStartIndex, positionedGlyphs.length - 1, justify);
        }

        x = 0;
        y += lineHeight * lineMaxScale;
    }

    const {horizontalAlign, verticalAlign} = getAnchorAlignment(textAnchor);
    align(positionedGlyphs, justify, horizontalAlign, verticalAlign, maxLineLength, lineHeight, lines.length);

    // Calculate the bounding box
    const height = y - yOffset;

    shaping.top += -verticalAlign * height;
    shaping.bottom = shaping.top + height;
    shaping.left += -horizontalAlign * maxLineLength;
    shaping.right = shaping.left + maxLineLength;
}

// justify right = 1, left = 0, center = 0.5
function justifyLine(positionedGlyphs: Array<PositionedGlyph>,
                     glyphMap: {[string]: {[number]: ?StyleGlyph}},
                     start: number,
                     end: number,
                     justify: 1 | 0 | 0.5) {
    if (!justify)
        return;

    const lastPositionedGlyph = positionedGlyphs[end];
    const positions = glyphMap[lastPositionedGlyph.fontStack];
    const glyph = positions && positions[lastPositionedGlyph.glyph];
    if (glyph) {
        const lastAdvance = glyph.metrics.advance * lastPositionedGlyph.scale;
        const lineIndent = (positionedGlyphs[end].x + lastAdvance) * justify;

        for (let j = start; j <= end; j++) {
            positionedGlyphs[j].x -= lineIndent;
        }
    }
}

function align(positionedGlyphs: Array<PositionedGlyph>,
               justify: number,
               horizontalAlign: number,
               verticalAlign: number,
               maxLineLength: number,
               lineHeight: number,
               lineCount: number) {
    const shiftX = (justify - horizontalAlign) * maxLineLength;
    const shiftY = (-verticalAlign * lineCount + 0.5) * lineHeight;

    for (let j = 0; j < positionedGlyphs.length; j++) {
        positionedGlyphs[j].x += shiftX;
        positionedGlyphs[j].y += shiftY;
    }
}

export type PositionedIcon = {
    image: ImagePosition,
    top: number,
    bottom: number,
    left: number,
    right: number
};

function shapeIcon(image: ImagePosition, iconOffset: [number, number], iconAnchor: SymbolAnchor): PositionedIcon {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(iconAnchor);
    const dx = iconOffset[0];
    const dy = iconOffset[1];
    const x1 = dx - image.displaySize[0] * horizontalAlign;
    const x2 = x1 + image.displaySize[0];
    const y1 = dy - image.displaySize[1] * verticalAlign;
    const y2 = y1 + image.displaySize[1];
    return {image, top: y1, bottom: y2, left: x1, right: x2};
}
