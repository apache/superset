var Jimp = require("jimp");

var url = "https://upload.wikimedia.org/wikipedia/commons/0/01/Bot-Test.jpg";

Jimp.read(url).then(function (image) {
    image.greyscale().getBuffer(Jimp.MIME_JPEG, onBuffer);
}).catch(function (err) {
    console.error(err);
})

function onBuffer(err, buffer) {
    if (err) throw err;
    console.log(buffer);
}
