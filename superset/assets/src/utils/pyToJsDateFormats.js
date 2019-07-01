const pythonToJsFormats = Object.freeze({
    '%a': 'ddd',
    '%A': 'dddd',
    '%w': 'd',
    '%d': 'DD',
    '%b': 'MMM',
    '%B': 'MMMM',
    '%m': 'MM',
    '%y': 'YY',
    '%Y': 'YYYY',
    '%H': 'HH',
    '%I': 'hh',
    '%p': 'A',
    '%M': 'mm',
    '%S': 'ss',
    '%f': 'SSS',
    '%z': 'ZZ',
    '%Z': 'z',
    '%j': 'DDDD',
    '%U': 'ww',		    // Week day of the year, Sunday first - not supported
    '%W': 'ww',		    // Week day of the year, Monday first
    '%c': 'ddd MMM DD HH:mm:ss YYYY',
    '%x': 'MM/DD/YYYY',
    '%X': 'HH:mm:ss',
    '%%': '%'
});

export default function convertPyToJsDateFormat(format) {
    var converted = format;
    for (var name in pythonToJsFormats) {
        if (pythonToJsFormats.hasOwnProperty(name)) {
            converted = converted.split(name).join(pythonToJsFormats[name]);
        }
    }
    return converted;
};
