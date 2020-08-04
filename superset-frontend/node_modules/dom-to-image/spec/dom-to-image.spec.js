(function (global) {
    'use strict';

    var assert = global.chai.assert;
    var imagediff = global.imagediff;
    var domtoimage = global.domtoimage;
    var Promise = global.Promise;

    var delay = domtoimage.impl.util.delay;

    var BASE_URL = '/base/spec/resources/';

    describe('domtoimage', function () {

        afterEach(purgePage);

        it('should load', function () {
            assert.ok(domtoimage);
        });

        describe('regression', function () {

            it('should render to svg', function (done) {
                loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image')
                    .then(function () {
                        return domtoimage.toSvg(domNode());
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should render to png', function (done) {
                loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode());
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should handle border', function (done) {
                loadTestPage('border/dom-node.html', 'border/style.css', 'border/control-image')
                    .then(renderAndCheck)
                    .then(done).catch(done);
            });

            it('should render to jpeg', function (done) {
                loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image-jpeg')
                    .then(function () {
                        return domtoimage.toJpeg(domNode());
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should use quality parameter when rendering to jpeg', function (done) {
                loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image-jpeg-low')
                    .then(function () {
                        return domtoimage.toJpeg(domNode(), { quality: 0.5 });
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should render to blob', function (done) {
                loadTestPage('small/dom-node.html', 'small/style.css', 'small/control-image')
                    .then(function () {
                        return domtoimage.toBlob(domNode());
                    })
                    .then(function (blob) {
                        return global.URL.createObjectURL(blob);
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should render bigger node', function (done) {
                loadTestPage('bigger/dom-node.html', 'bigger/style.css', 'bigger/control-image')
                    .then(function () {
                        var parent = $('#dom-node');
                        var child = $('.dom-child-node');
                        for (var i = 0; i < 10; i++) {
                            parent.append(child.clone());
                        }
                    })
                    .then(renderAndCheck)
                    .then(done).catch(done);
            });

            it('should handle "#" in colors and attributes', function (done) {
                loadTestPage('hash/dom-node.html', 'hash/style.css', 'small/control-image')
                    .then(renderAndCheck)
                    .then(done).catch(done);
            });

            it('should render nested svg with broken namespace', function (done) {
                loadTestPage('svg-ns/dom-node.html', 'svg-ns/style.css', 'svg-ns/control-image')
                    .then(renderAndCheck)
                    .then(done).catch(done);
            });

            it('should render svg <rect> with width and heigth', function (done) {
                loadTestPage('svg-rect/dom-node.html', 'svg-rect/style.css', 'svg-rect/control-image')
                    .then(renderAndCheck)
                    .then(done).catch(done);
            });

            it('should render whole node when its scrolled', function (done) {
                var domNode;
                loadTestPage('scroll/dom-node.html', 'scroll/style.css', 'scroll/control-image')
                    .then(function () {
                        domNode = $('#scrolled')[0];
                    })
                    .then(function () {
                        return renderToPng(domNode);
                    })
                    .then(makeImgElement)
                    .then(function (image) {
                        return drawImgElement(image, domNode);
                    })
                    .then(compareToControlImage)
                    .then(done).catch(done);
            });

            it('should render text nodes', function (done) {
                this.timeout(10000);
                loadTestPage('text/dom-node.html', 'text/style.css')
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(['SOME TEXT', 'SOME MORE TEXT']))
                    .then(done).catch(done);
            });

            it('should preserve content of ::before and ::after pseudo elements', function (done) {
                this.timeout(10000);
                loadTestPage('pseudo/dom-node.html', 'pseudo/style.css')
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(["JUSTBEFORE", "BOTHBEFORE"]))
                    .then(assertTextRendered(["JUSTAFTER", "BOTHAFTER"]))
                    .then(done).catch(done);
            });

            it('should use node filter', function (done) {
                function filter(node) {
                    if (node.classList) return !node.classList.contains('omit');
                    return true;
                }

                loadTestPage('filter/dom-node.html', 'filter/style.css', 'filter/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode(), {
                            filter: filter
                        });
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should not apply node filter to root node', function (done) {
                function filter(node) {
                    if (node.classList) return node.classList.contains('include');
                    return false;
                }

                loadTestPage('filter/dom-node.html', 'filter/style.css', 'filter/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode(), {
                            filter: filter
                        });
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should render with external stylesheet', function (done) {
                loadTestPage('sheet/dom-node.html', 'sheet/style.css', 'sheet/control-image')
                    .then(delay(1000))
                    .then(renderAndCheck)
                    .then(done).catch(done);
            });

            it('should render web fonts', function (done) {
                this.timeout(10000);
                loadTestPage('fonts/dom-node.html', 'fonts/style.css')
                    .then(delay(1000))
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(['O']))
                    .then(done).catch(done);
            });

            it('should render images', function (done) {
                loadTestPage('images/dom-node.html', 'images/style.css')
                    .then(delay(500))
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(["PNG", "JPG"]))
                    .then(done).catch(done);
            });

            it('should render background images', function (done) {
                loadTestPage('css-bg/dom-node.html', 'css-bg/style.css')
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(["JPG"]))
                    .then(done).catch(done);
            });

            it('should render user input from <textarea>', function (done) {
                loadTestPage('textarea/dom-node.html', 'textarea/style.css')
                    .then(function () {
                        document.getElementById('input').value = "USER\nINPUT";
                    })
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(["USER\nINPUT"]))
                    .then(done).catch(done);
            });

            it('should render user input from <input>', function (done) {
                loadTestPage('input/dom-node.html', 'input/style.css')
                    .then(function () {
                        document.getElementById('input').value = "USER INPUT";
                    })
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(["USER INPUT"]))
                    .then(done).catch(done);
            });

            it('should render content from <canvas>', function (done) {
                loadTestPage('canvas/dom-node.html', 'canvas/style.css')
                    .then(function () {
                        var canvas = document.getElementById('content');
                        var ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.fillStyle = '#000000';
                        ctx.font = '100px monospace';
                        ctx.fillText('0', canvas.width / 2, canvas.height / 2);
                    })
                    .then(renderToPng)
                    .then(drawDataUrl)
                    .then(assertTextRendered(['0']))
                    .then(done).catch(done);
            });

            it('should render bgcolor', function (done) {
                loadTestPage('bgcolor/dom-node.html', 'bgcolor/style.css', 'bgcolor/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode(), {
                            bgcolor: "#ff0000"
                        });
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should render bgcolor in SVG', function (done) {
                loadTestPage('bgcolor/dom-node.html', 'bgcolor/style.css', 'bgcolor/control-image')
                    .then(function () {
                        return domtoimage.toSvg(domNode(), {
                            bgcolor: "#ff0000"
                        });
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should not crash when loading external stylesheet causes error', function (done) {
                loadTestPage('ext-css/dom-node.html', 'ext-css/style.css')
                    .then(delay(1000))
                    .then(renderToPng)
                    .then(function () {
                        done();
                    })
                    .catch(done);
            });

            it('should convert an element to an array of pixels', function (done) {
                loadTestPage('pixeldata/dom-node.html', 'pixeldata/style.css')
                    .then(delay(1000))
                    .then(function () {
                        return domtoimage.toPixelData(domNode());
                    })
                    .then(function (pixels) {
                        for (var y = 0; y < domNode().scrollHeight; ++y) {
                            for (var x = 0; x < domNode().scrollWidth; ++x) {
                                var rgba = [0, 0, 0, 0];

                                if (y < 10) {
                                    rgba[0] = 255;
                                } else if (y < 20) {
                                    rgba[1] = 255;
                                } else {
                                    rgba[2] = 255;
                                }

                                if (x < 10) {
                                    rgba[3] = 255;
                                } else if (x < 20) {
                                    rgba[3] = 0.4 * 255;
                                } else {
                                    rgba[3] = 0.2 * 255;
                                }

                                var offset = (4 * y * domNode().scrollHeight) + (4 * x);

                                assert.deepEqual(pixels.slice(offset, offset + 4), Uint8Array.from(rgba));
                            }
                        }
                    })
                    .then(done).catch(done);
            });

            it('should apply width and height options to node copy being rendered', function (done) {
                loadTestPage('dimensions/dom-node.html', 'dimensions/style.css', 'dimensions/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode(), {
                            width: 200,
                            height: 200
                        });
                    })
                    .then(function (dataUrl) {
                        return drawDataUrl(dataUrl, { width: 200, height: 200 });
                    })
                    .then(compareToControlImage)
                    .then(done).catch(done);
            });

            it('should apply style text to node copy being rendered', function (done) {
                loadTestPage('style/dom-node.html', 'style/style.css', 'style/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode(), {
                            style: { 'background-color': 'red', 'transform': 'scale(0.5)' }
                        });
                    })
                    .then(check)
                    .then(done).catch(done);
            });

            it('should combine dimensions and style', function (done) {
                loadTestPage('scale/dom-node.html', 'scale/style.css', 'scale/control-image')
                    .then(function () {
                        return domtoimage.toPng(domNode(), {
                            width: 200,
                            height: 200,
                            style: {
                                'transform': 'scale(2)',
                                'transform-origin': 'top left'
                            }
                        });
                    })
                    .then(function (dataUrl) {
                        return drawDataUrl(dataUrl, { width: 200, height: 200 });
                    })
                    .then(compareToControlImage)
                    .then(done).catch(done);
            });

            function compareToControlImage(image, tolerance) {
                assert.isTrue(imagediff.equal(image, controlImage(), tolerance), 'rendered and control images should be same');
            }

            function renderAndCheck() {
                return Promise.resolve()
                    .then(renderToPng)
                    .then(check);
            }

            function check(dataUrl) {
                return Promise.resolve(dataUrl)
                    .then(drawDataUrl)
                    .then(compareToControlImage);
            }

            function drawDataUrl(dataUrl, dimensions) {
                return Promise.resolve(dataUrl)
                    .then(makeImgElement)
                    .then(function (image) {
                        return drawImgElement(image, null, dimensions);
                    });
            }

            function assertTextRendered(lines) {
                return function () {
                    return new Promise(function (resolve, reject) {
                        Tesseract.recognize(canvas())
                            .then(function(result) {
                                lines.forEach(function(line) {
                                    try {
                                        assert.include(result.text, line);
                                    } catch(e) {
                                        reject(e);
                                    }
                                });
                                resolve();
                            });
                    });
                };
            }

            function makeImgElement(src) {
                return new Promise(function (resolve) {
                    var image = new Image();
                    image.onload = function () {
                        resolve(image);
                    };
                    image.src = src;
                });
            }

            function drawImgElement(image, node, dimensions) {
                node = node || domNode();
                dimensions = dimensions || {};
                canvas().height = dimensions.height || node.offsetHeight.toString();
                canvas().width = dimensions.width || node.offsetWidth.toString();
                canvas().getContext('2d').imageSmoothingEnabled = false;
                canvas().getContext('2d').drawImage(image, 0, 0);
                return image;
            }

            function renderToPng(node) {
                return domtoimage.toPng(node || domNode());
            }
        });

        describe('inliner', function () {

            var NO_BASE_URL = null;

            it('should parse urls', function () {
                var parse = domtoimage.impl.inliner.impl.readUrls;

                assert.deepEqual(parse('url("http://acme.com/file")'), ['http://acme.com/file']);
                assert.deepEqual(parse('url(foo.com), url(\'bar.org\')'), ['foo.com', 'bar.org']);
            });

            it('should ignore data urls', function () {
                var parse = domtoimage.impl.inliner.impl.readUrls;

                assert.deepEqual(parse('url(foo.com), url(data:AAA)'), ['foo.com']);
            });

            it('should inline url', function (done) {
                var inline = domtoimage.impl.inliner.impl.inline;

                inline('url(http://acme.com/image.png), url(foo.com)', 'http://acme.com/image.png',
                        NO_BASE_URL,
                        function () {
                            return Promise.resolve('AAA');
                        })
                    .then(function (result) {
                        assert.equal(result, 'url(data:image/png;base64,AAA), url(foo.com)');
                    })
                    .then(done).catch(done);
            });

            it('should resolve urls if base url given', function (done) {
                var inline = domtoimage.impl.inliner.impl.inline;

                inline('url(images/image.png)', 'images/image.png', 'http://acme.com/',
                        function (url) {
                            return Promise.resolve({
                                'http://acme.com/images/image.png': 'AAA'
                            }[url]);
                        }
                    )
                    .then(function (result) {
                        assert.equal(result, 'url(data:image/png;base64,AAA)');
                    })
                    .then(done).catch(done);
            });

            it('should inline all urls', function (done) {
                var inlineAll = domtoimage.impl.inliner.inlineAll;

                inlineAll('url(http://acme.com/image.png), url("foo.com/font.ttf")',
                        NO_BASE_URL,
                        function (url) {
                            return Promise.resolve({
                                'http://acme.com/image.png': 'AAA',
                                'foo.com/font.ttf': 'BBB'
                            }[url]);
                        }
                    )
                    .then(function (result) {
                        assert.equal(result, 'url(data:image/png;base64,AAA), url("data:application/font-truetype;base64,BBB")');
                    })
                    .then(done).catch(done);
            });
        });

        describe('util', function () {

            it('should get and encode resource', function (done) {
                var getAndEncode = domtoimage.impl.util.getAndEncode;
                getResource('util/fontawesome.base64')
                    .then(function (testResource) {
                        return getAndEncode(BASE_URL + 'util/fontawesome.woff2')
                            .then(function (resource) {
                                assert.equal(resource, testResource);
                            });
                    })
                    .then(done).catch(done);
            });

            it('should return empty result if cannot get resource', function (done) {
                domtoimage.impl.util.getAndEncode(BASE_URL + 'util/not-found')
                    .then(function (resource) {
                        assert.equal(resource, '');
                    }).then(done).catch(done);
            });

            it('should return placeholder result if cannot get resource and placeholder is provided', function (done) {
                var placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAMSURBVBhXY7h79y4ABTICmGnXPbMAAAAASUVORK5CYII=";
                var original = domtoimage.impl.options.imagePlaceholder;
                domtoimage.impl.options.imagePlaceholder = placeholder;
                domtoimage.impl.util.getAndEncode(BASE_URL + 'util/not-found')
                    .then(function (resource) {
                        var placeholderData = placeholder.split(/,/)[1];
                        assert.equal(resource, placeholderData);
                        domtoimage.impl.options.imagePlaceholder = original;
                    }).then(done).catch(done);
            });

            it('should parse extension', function () {
                var parse = domtoimage.impl.util.parseExtension;

                assert.equal(parse('http://acme.com/font.woff'), 'woff');
                assert.equal(parse('../FONT.TTF'), 'TTF');
                assert.equal(parse('../font'), '');
                assert.equal(parse('font'), '');
            });

            it('should guess mime type from url', function () {
                var mime = domtoimage.impl.util.mimeType;

                assert.equal(mime('http://acme.com/font.woff'), 'application/font-woff');
                assert.equal(mime('IMAGE.PNG'), 'image/png');
                assert.equal(mime('http://acme.com/image'), '');
            });

            it('should resolve url', function () {
                var resolve = domtoimage.impl.util.resolveUrl;

                assert.equal(resolve('font.woff', 'http://acme.com'), 'http://acme.com/font.woff');
                assert.equal(resolve('/font.woff', 'http://acme.com/fonts/woff'), 'http://acme.com/font.woff');

                assert.equal(resolve('../font.woff', 'http://acme.com/fonts/woff/'), 'http://acme.com/fonts/font.woff');
                assert.equal(resolve('../font.woff', 'http://acme.com/fonts/woff'), 'http://acme.com/font.woff');
            });

            it('should generate uids', function () {
                var uid = domtoimage.impl.util.uid;
                assert(uid().length >= 4);
                assert.notEqual(uid(), uid());
            });
        });

        describe('web fonts', function () {
            var fontFaces = domtoimage.impl.fontFaces;

            it('should read non-local font faces', function (done) {
                loadTestPage('fonts/web-fonts/empty.html', 'fonts/web-fonts/rules.css')
                    .then(function () {
                        return fontFaces.impl.readAll();
                    })
                    .then(function (webFonts) {
                        assert.equal(webFonts.length, 3);

                        var sources = webFonts.map(function (webFont) {
                            return webFont.src();
                        });
                        assertSomeIncludesAll(sources, ['http://fonts.com/font1.woff', 'http://fonts.com/font1.woff2']);
                        assertSomeIncludesAll(sources, ['http://fonts.com/font2.ttf?v1.1.3']);
                        assertSomeIncludesAll(sources, ['data:font/woff2;base64,AAA']);
                    })
                    .then(done).catch(done);
            });

            function assertSomeIncludesAll(haystacks, needles) {
                assert(
                    haystacks.some(function (haystack) {
                        return needles.every(function (needle) {
                            return (haystack.indexOf(needle) !== -1);
                        });
                    }),
                    '\nnone of\n[ ' + haystacks.join('\n') + ' ]\nincludes all of \n[ ' + needles.join(', ') + ' ]'
                );
            }
        });

        describe('images', function () {

            it('should not inline images with data url', function (done) {
                var originalSrc = 'data:image/jpeg;base64,AAA';

                var img = new Image();
                img.src = originalSrc;

                domtoimage.impl.images.impl.newImage(img).inline(function () {
                        return Promise.resolve('XXX');
                    })
                    .then(function () {
                        assert.equal(img.src, originalSrc);
                    })
                    .then(done).catch(done);
            });
        });

        function loadTestPage(html, css, controlImage) {
            return loadPage()
                .then(function () {
                    return getResource(html).then(function (html) {
                        $('#dom-node').html(html);
                    });
                })
                .then(function () {
                    if (css)
                        return getResource(css).then(function (css) {
                            $('#style').append(document.createTextNode(css));
                        });
                })
                .then(function () {
                    if (controlImage)
                        return getResource(controlImage).then(function (image) {
                            $('#control-image').attr('src', image);
                        });
                });
        }

        function loadPage() {
            return getResource('page.html')
                .then(function (html) {
                    var root = document.createElement('div');
                    root.id = 'test-root';
                    root.innerHTML = html;
                    document.body.appendChild(root);
                });
        }

        function purgePage() {
            var root = $('#test-root');
            if (root) root.remove();
        }

        function domNode() {
            return $('#dom-node')[0];
        }

        function controlImage() {
            return $('#control-image')[0];
        }

        function canvas() {
            return $('#canvas')[0];
        }

        function getResource(fileName) {
            var url = BASE_URL + fileName;
            var request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.responseType = 'text';

            return new Promise(function (resolve, reject) {
                request.onload = function () {
                    if (this.status === 200)
                        resolve(request.response.toString().trim());
                    else
                        reject(new Error('cannot load ' + url));
                };
                request.send();
            });
        }
    });
})(this);
