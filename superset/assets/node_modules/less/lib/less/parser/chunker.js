// Split the input into chunks.
module.exports = function (input, fail) {
    var len = input.length, level = 0, parenLevel = 0,
        lastOpening, lastOpeningParen, lastMultiComment, lastMultiCommentEndBrace,
        chunks = [], emitFrom = 0,
        chunkerCurrentIndex, currentChunkStartIndex, cc, cc2, matched;

    function emitChunk(force) {
        var len = chunkerCurrentIndex - emitFrom;
        if (((len < 512) && !force) || !len) {
            return;
        }
        chunks.push(input.slice(emitFrom, chunkerCurrentIndex + 1));
        emitFrom = chunkerCurrentIndex + 1;
    }

    for (chunkerCurrentIndex = 0; chunkerCurrentIndex < len; chunkerCurrentIndex++) {
        cc = input.charCodeAt(chunkerCurrentIndex);
        if (((cc >= 97) && (cc <= 122)) || (cc < 34)) {
            // a-z or whitespace
            continue;
        }

        switch (cc) {
            case 40:                        // (
                parenLevel++;
                lastOpeningParen = chunkerCurrentIndex;
                continue;
            case 41:                        // )
                if (--parenLevel < 0) {
                    return fail('missing opening `(`', chunkerCurrentIndex);
                }
                continue;
            case 59:                        // ;
                if (!parenLevel) { emitChunk(); }
                continue;
            case 123:                       // {
                level++;
                lastOpening = chunkerCurrentIndex;
                continue;
            case 125:                       // }
                if (--level < 0) {
                    return fail('missing opening `{`', chunkerCurrentIndex);
                }
                if (!level && !parenLevel) { emitChunk(); }
                continue;
            case 92:                        // \
                if (chunkerCurrentIndex < len - 1) { chunkerCurrentIndex++; continue; }
                return fail('unescaped `\\`', chunkerCurrentIndex);
            case 34:
            case 39:
            case 96:                        // ", ' and `
                matched = 0;
                currentChunkStartIndex = chunkerCurrentIndex;
                for (chunkerCurrentIndex = chunkerCurrentIndex + 1; chunkerCurrentIndex < len; chunkerCurrentIndex++) {
                    cc2 = input.charCodeAt(chunkerCurrentIndex);
                    if (cc2 > 96) { continue; }
                    if (cc2 == cc) { matched = 1; break; }
                    if (cc2 == 92) {        // \
                        if (chunkerCurrentIndex == len - 1) {
                            return fail('unescaped `\\`', chunkerCurrentIndex);
                        }
                        chunkerCurrentIndex++;
                    }
                }
                if (matched) { continue; }
                return fail('unmatched `' + String.fromCharCode(cc) + '`', currentChunkStartIndex);
            case 47:                        // /, check for comment
                if (parenLevel || (chunkerCurrentIndex == len - 1)) { continue; }
                cc2 = input.charCodeAt(chunkerCurrentIndex + 1);
                if (cc2 == 47) {
                    // //, find lnfeed
                    for (chunkerCurrentIndex = chunkerCurrentIndex + 2; chunkerCurrentIndex < len; chunkerCurrentIndex++) {
                        cc2 = input.charCodeAt(chunkerCurrentIndex);
                        if ((cc2 <= 13) && ((cc2 == 10) || (cc2 == 13))) { break; }
                    }
                } else if (cc2 == 42) {
                    // /*, find */
                    lastMultiComment = currentChunkStartIndex = chunkerCurrentIndex;
                    for (chunkerCurrentIndex = chunkerCurrentIndex + 2; chunkerCurrentIndex < len - 1; chunkerCurrentIndex++) {
                        cc2 = input.charCodeAt(chunkerCurrentIndex);
                        if (cc2 == 125) { lastMultiCommentEndBrace = chunkerCurrentIndex; }
                        if (cc2 != 42) { continue; }
                        if (input.charCodeAt(chunkerCurrentIndex + 1) == 47) { break; }
                    }
                    if (chunkerCurrentIndex == len - 1) {
                        return fail('missing closing `*/`', currentChunkStartIndex);
                    }
                    chunkerCurrentIndex++;
                }
                continue;
            case 42:                       // *, check for unmatched */
                if ((chunkerCurrentIndex < len - 1) && (input.charCodeAt(chunkerCurrentIndex + 1) == 47)) {
                    return fail('unmatched `/*`', chunkerCurrentIndex);
                }
                continue;
        }
    }

    if (level !== 0) {
        if ((lastMultiComment > lastOpening) && (lastMultiCommentEndBrace > lastMultiComment)) {
            return fail('missing closing `}` or `*/`', lastOpening);
        } else {
            return fail('missing closing `}`', lastOpening);
        }
    } else if (parenLevel !== 0) {
        return fail('missing closing `)`', lastOpeningParen);
    }

    emitChunk(true);
    return chunks;
};
