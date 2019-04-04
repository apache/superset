// @flow

import {
    charHasRotatedVerticalOrientation,
} from './script_detection';

export const verticalizedCharacterMap = {
    '!': '︕',
    '#': '＃',
    '$': '＄',
    '%': '％',
    '&': '＆',
    '(': '︵',
    ')': '︶',
    '*': '＊',
    '+': '＋',
    ',': '︐',
    '-': '︲',
    '.': '・',
    '/': '／',
    ':': '︓',
    ';': '︔',
    '<': '︿',
    '=': '＝',
    '>': '﹀',
    '?': '︖',
    '@': '＠',
    '[': '﹇',
    '\\': '＼',
    ']': '﹈',
    '^': '＾',
    '_': '︳',
    '`': '｀',
    '{': '︷',
    '|': '―',
    '}': '︸',
    '~': '～',
    '¢': '￠',
    '£': '￡',
    '¥': '￥',
    '¦': '￤',
    '¬': '￢',
    '¯': '￣',
    '–': '︲',
    '—': '︱',
    '‘': '﹃',
    '’': '﹄',
    '“': '﹁',
    '”': '﹂',
    '…': '︙',
    '‧': '・',
    '₩': '￦',
    '、': '︑',
    '。': '︒',
    '〈': '︿',
    '〉': '﹀',
    '《': '︽',
    '》': '︾',
    '「': '﹁',
    '」': '﹂',
    '『': '﹃',
    '』': '﹄',
    '【': '︻',
    '】': '︼',
    '〔': '︹',
    '〕': '︺',
    '〖': '︗',
    '〗': '︘',
    '！': '︕',
    '（': '︵',
    '）': '︶',
    '，': '︐',
    '－': '︲',
    '．': '・',
    '：': '︓',
    '；': '︔',
    '＜': '︿',
    '＞': '﹀',
    '？': '︖',
    '［': '﹇',
    '］': '﹈',
    '＿': '︳',
    '｛': '︷',
    '｜': '―',
    '｝': '︸',
    '｟': '︵',
    '｠': '︶',
    '｡': '︒',
    '｢': '﹁',
    '｣': '﹂'
};

export default function verticalizePunctuation(input: string) {
    let output = '';

    for (let i = 0; i < input.length; i++) {
        const nextCharCode = input.charCodeAt(i + 1) || null;
        const prevCharCode = input.charCodeAt(i - 1) || null;

        const canReplacePunctuation = (
            (!nextCharCode || !charHasRotatedVerticalOrientation(nextCharCode) || verticalizedCharacterMap[input[i + 1]]) &&
            (!prevCharCode || !charHasRotatedVerticalOrientation(prevCharCode) || verticalizedCharacterMap[input[i - 1]])
        );

        if (canReplacePunctuation && verticalizedCharacterMap[input[i]]) {
            output += verticalizedCharacterMap[input[i]];
        } else {
            output += input[i];
        }
    }

    return output;
}

