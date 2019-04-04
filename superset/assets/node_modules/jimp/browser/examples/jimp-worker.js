importScripts("../lib/jimp.min.js");

self.addEventListener("message", function(e) {
    Jimp.read(e.data).then(function (lenna) {
        lenna.resize(256, Jimp.AUTO)      // resize
             .quality(60)                 // set JPEG quality
             .greyscale()                 // set greyscale
             .getBase64(Jimp.AUTO, function (err, src) {
                self.postMessage(src);
                self.close();
             });
    });
});
