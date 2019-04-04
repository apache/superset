var fs  = require("fs");
var Iconv  = require("iconv").Iconv;


var encodingFamilies = [
    {
        // Windows code pages
        encodings: [1250, 1251, 1252, 1253, 1254, 1255, 1256, 1257, 1258],
        convert: function(cp) {
            return {
                name: "windows-"+cp,
                aliases: ["win"+cp, "cp"+cp, ""+cp],
            }
        }
    },
    {
        // ISO-8859 code pages
        encodings: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16],
        convert: function(i) {
            return {
                name: "iso-8859-"+i,
                aliases: ["cp"+(28590+i), (28590+i)],
            }
        }
    },
    {
        // IBM/DOS code pages
        encodings: [437, 737, 775, 850, 852, 855, 857, 858, 860, 861, 862, 863, 864, 865, 866, 869],
        convert: function(cp) {
            return {
                name: "CP"+cp,
                aliases: ["ibm"+cp, ""+cp],
            }
        }
    },
    {
        // Macintosh code pages
        encodings: ["macCroatian", "macCyrillic", "macGreek", 
                    "macIceland", "macRoman", "macRomania", 
                    "macThai", "macTurkish", "macUkraine"],
    },
    {
        // KOI8 code pages
        encodings: ["KOI8-R", "KOI8-U"],
    },
];


var encodings = {
    // Aliases.
    "ascii8bit": "ascii",
    "usascii": "ascii",

    "latin1": "iso88591",
    "latin2": "iso88592",
    "latin3": "iso88593",
    "latin4": "iso88594",
    "latin6": "iso885910",
    "latin7": "iso885913",
    "latin8": "iso885914",
    "latin9": "iso885915",
    "latin10": "iso885916",

    "cp819": "iso88951",
    "arabic": "iso88596",
    "arabic8": "iso88596",
    "greek" : "iso88597",
    "greek8" : "iso88597",
    "hebrew": "iso88598",
    "hebrew8": "iso88598",
    "turkish": "iso88599",
    "turkish8": "iso88599",
    "thai": "iso885911",
    "thai8": "iso885911",
    "tis620": "iso885911",
    "windows874": "iso885911",
    "win874": "iso885911",
    "cp874": "iso885911",
    "874": "iso885911",
    "celtic": "iso885914",
    "celtic8": "iso885914",

    "cp20866": "koi8r",
    "20866": "koi8r",
    "ibm878": "koi8r",
    "cp21866": "koi8u",
    "21866": "koi8u",
    "ibm1168": "koi8u",
    
};

// Add all encodings from encodingFamilies.
encodingFamilies.forEach(function(family){
    family.encodings.forEach(function(encoding){
        if (family.convert)
            encoding = family.convert(encoding);

        var encodingIconvName = encoding.name ? encoding.name : encoding; 
        var encodingName = encodingIconvName.replace(/[-_]/g, "").toLowerCase();

        encodings[encodingName] = {
            type: "singlebyte",
            chars: generateCharsString(encodingIconvName)
        };

        if (encoding.aliases)
            encoding.aliases.forEach(function(alias){
                encodings[alias] = encodingName;
            });
    });
});

// Write encodings.
fs.writeFileSync("encodings/singlebyte.js", 
    "module.exports = " + JSON.stringify(encodings, undefined, "  ") + ";");


function generateCharsString(encoding) {
    console.log("Generate encoding for " + encoding);
    var iconvToUtf8 = new Iconv(encoding, "UTF-8");
    var chars = "";

    for (var b = 0x80; b < 0x100; b++) {

        try {
            var convertedChar = iconvToUtf8.convert(new Buffer([b])).toString();
            
            if (convertedChar.length != 1)
                throw new Error("Single-byte encoding error: Must return single char.");
        } catch (exception) {
            if (exception.code === "EILSEQ") {
                convertedChar = "\ufffd";
            } else {
                throw exception;
            }
        }

        chars += convertedChar;
    }

    return chars;
}
