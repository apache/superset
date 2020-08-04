declare namespace terminalLink {
	interface Options {
		/**
		Override the default fallback. If false, the fallback will be disabled.

		@default `${text} (${url})`
		*/
		fallback?: ((text: string, url: string) => string) | boolean;
	}
}

declare const terminalLink: {
	/**
	Create a clickable link in the terminal's stdout.

	[Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
	For unsupported terminals, the link will be printed in parens after the text: `My website (https://sindresorhus.com)`,
	unless the fallback is disabled by setting the `fallback` option to `false`.

	@param text - Text to linkify.
	@param url - URL to link to.

	@example
	```
	import terminalLink = require('terminal-link');

	const link = terminalLink('My Website', 'https://sindresorhus.com');
	console.log(link);
	```
	*/
	(text: string, url: string, options?: terminalLink.Options): string;

	/**
	Check whether the terminal supports links.

	Prefer just using the default fallback or the `fallback` option whenever possible.
	*/
	readonly isSupported: boolean;

	readonly stderr: {
		/**
		Create a clickable link in the terminal's stderr.

		[Supported terminals.](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
		For unsupported terminals, the link will be printed in parens after the text: `My website (https://sindresorhus.com)`.

		@param text - Text to linkify.
		@param url - URL to link to.

		@example
		```
		import terminalLink = require('terminal-link');

		const link = terminalLink.stderr('My Website', 'https://sindresorhus.com');
		console.error(link);
		```
		*/
		(text: string, url: string, options?: terminalLink.Options): string;

		/**
		Check whether the terminal's stderr supports links.

		Prefer just using the default fallback or the `fallback` option whenever possible.
		*/
		readonly isSupported: boolean;
	}
};

export = terminalLink;
