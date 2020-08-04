ocrad.js
========

OCR in Javascript via Emscripten



As with any minor stepping stone on the <strikeout>road to hell</strikeout> relentless trajectory of <link>Atwood's Law, I probably don't need to justify the existence of yet another "x, but now in Javascript!", but I might as well try. After all, we all would like to think that there's some ulterior motive to fulfilling that prophesy. 

On tablet or other touchscreen devices- of which there are quite a number of nowadays (as the New Year's Eve post, I am obliged to include conjecture about the technological zeitgeist), a library such as Ocrad.js might be used to add handwriting input in a device and operating system agnostic manner. Oftentimes, capturing the strokes and sending them over to a server to process might entail unacceptably high latency. Maybe you're working on an offline-capable note-taking app, or a browser extension which indexes all the doge memes that you stumble upon while prawling the dark corners of the internet.

If you've been following my trail of blog posts recently, you'd probably be able to tell that I've been scrambling to finish the program that I prototyped many months ago overnight at a Hackathon. The idea of the extension was kind of simple and also kind of magical: a browser extension that allowed users to highlight, copy, and paste text from any image as if it were plain text. Of course the implementation is a bit difficult and actually relies on the advent of a number of newfangled technologies.

If you try to search for some open source text recognition engine, the first thing that comes up is Tesseract. That isn't a mistake, because it turns out that the competition is worlds away in terms of accuracy. It's actually pretty sad that the state of the art hasn't progressed substantially since the mid-nineties.

A month ago, I tried compiling Tesseract using Emscripten. Perhaps it was a bad thing to try first, but soon I learned that even if it did work out, it probably wouldn't have been practical anyway. I had figured that all OCR engines had been powered by artificial neural networks, support vector machines, k-nearest-neighbors and their machine learning kin. It turns out that this is hardly the norm except in the realm of the actually-accurate, whose open source provinces live under the protection of Lord Tesseract. 

GOCR and Ocrad are essentially the only other open source OCR engines (there's technically also Cuneiform, but the source code is in a really really big zip file from some website in Russian and its also really slow according to benchmarks). And something I didn't realize until I had peered into the source code is that they are powered by (presumably) painstakingly written rules for each and every detectable glyph and variation. This kind of blew my mind.

Anyway, I tried to compile GOCR first and was immediately struck by how easy and painless it had been. I was on a roll, and decided to do Ocrad as well. It wasn't particularly hard- sure it was slightly more involved but still hardly anything. 

If you know me in person, you'll probably know that I'm not a terribly decisive person. Oftentimes, I'll delay the decision until there isn't a choice left for me to make. Anyway, serially-indecisive-me strikes again, so I alternated between the development of GOCR.js and Ocrad.js, leading up to a simultaneous release.

But in the back of my mind, I knew that eventually I would have to pick one for building my image highlighting project. 

What consistently amazes me about Optical Character Recognition isn't its astonishing quality or lack thereof. Rather, it's how utterly unpredictable the results can be. Sometimes there'll be some barely legible block of text that comes through absolutely pristine, and some other time there will be a perfectly clean input which outputs complete garbage. Maybe this is a testament to the sheer difficulty of computer vision or the incredible and underappreciated abilities of the human visual cortex.

At one point, I was talking to someone and I distinctly remembered (I know, all the best stories start this way) a sense of surprise when the person indicated that he had heard of Tesseract, the open source OCR engine. I had appraised it as somewhat more obscure than it evidently was. Some time later, I confided about the incident with a friend, and he said something along the lines of "OCR is one of those fields that everyone comes across once".

I guess I've kind of held onto that thought for a while now, and it certainly seems to have at least a grain of truth. Text embedded into the physical world is more or less our primary means we have for communication and expression. Technology is about building tools that augment human capacity and inevitably entails supplanting some human capability. Data input is a huge bottleneck, and while we're kind of sidestepping the problem with things like QR codes by bringing the digital world into the physical. OCR is just one of those fundamental enabling technologies which ought to be as broad in scope as the set of humans who have interacted with a keyboard.

I can't help but feel that the rather large set of people who have interacted with the problem character recognition have surveyed the available tools and reached the same conclusion as your miniature Magic 8 Ball desk ornament: "Try again later". It doesn't take long for one to discover an instance of perfectly crisp and legible type which results in line noise of such entropy that it'd give DUAL_EC_DRBG a run for its money. "No, there really isn't any way for this to be the state of the art." "Well, I guess if it is, then maybe it'll improve in a few years- technology improves quickly, right?" 

You would think that some analogue of Linus's Law would hold true: "given enough eyeballs, all bugs are shallow"- especially if you're dealing with literal eyeballs reading letters. But incidentally, the engine that absolutely everyone uses was developed three decades ago (It's older than I am!), abandoned for a decade before being acquired and released to the world (by our favorite benevolent overlords, Google). 

In fact, what's absolutely stunning is the sheer universality of Tesseract. Just about everything which claims to have text recognition as a feature is backed by it. At one point, I was hoping that Mathematica had some clever routine using morphology and symbolic new kinds of sciences and evolved automata pattern recognition. Nope! Nestled deep within the gigabytes of code lies the Chuck Testa of textadermies: Tesseract.





