// based on https://github.com/webpack/webpack/blob/master/bin/webpack.js

/**
 * @param {string} command process to run
 * @param {string[]} args commandline arguments
 * @returns {Promise<void>} promise
 */
const runCommand = (command, args) => {
	const cp = require("child_process");
	return new Promise((resolve, reject) => {
		resolve();
		const executedCommand = cp.spawn(command, args, {
			stdio: "inherit",
			shell: true
		});

		executedCommand.on("error", error => {
			reject(error);
		});

		executedCommand.on("exit", code => {
			if (code === 0) {
				resolve();
			} else {
				reject();
			}
		});
	});
};

module.exports = function promptForInstallation(packages, ...args) {
	const nameOfPackage = "@webpack-cli/" + packages;
	let packageIsInstalled = false;
	let pathForCmd;
	try {
		const path = require("path");
		pathForCmd = path.resolve(
			process.cwd(),
			"node_modules",
			"@webpack-cli",
			packages
		);
		require.resolve(pathForCmd);
		packageIsInstalled = true;
	} catch (err) {
		packageIsInstalled = false;
	}
	if (!packageIsInstalled) {
		const path = require("path");
		const fs = require("fs");
		const readLine = require("readline");
		const isYarn = fs.existsSync(path.resolve(process.cwd(), "yarn.lock"));

		const packageManager = isYarn ? "yarn" : "npm";
		const options = ["install", "-D", nameOfPackage];

		if (isYarn) {
			options[0] = "add";
		}

		const commandToBeRun = `${packageManager} ${options.join(" ")}`;

		const question = `Would you like to install ${packages}? (That will run ${commandToBeRun}) (yes/NO)`;

		console.error(
			`The command moved into a separate package: ${nameOfPackage}`
		);
		const questionInterface = readLine.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		questionInterface.question(question, answer => {
			questionInterface.close();
			switch (answer.toLowerCase()) {
				case "y":
				case "yes":
				case "1": {
					//eslint-disable-next-line
					runCommand(packageManager, options)
						.then(result => {
							pathForCmd = path.resolve(
								process.cwd(),
								"node_modules",
								"@webpack-cli",
								packages
							);
							if (packages === "serve") {
								return require(pathForCmd).default.serve();
							}
							return require(pathForCmd).default(...args); //eslint-disable-line
						})
						.catch(error => {
							console.error(error);
							process.exitCode = 1;
						});
					break;
				}
				default: {
					console.error(
						`${nameOfPackage} needs to be installed in order to run the command.`
					);
					process.exitCode = 1;
					break;
				}
			}
		});
	} else {
		require(pathForCmd).default(...args); // eslint-disable-line
	}
};
