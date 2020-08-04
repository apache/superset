// based on https://github.com/webpack/webpack/blob/master/bin/webpack.js

/**
 * @param {string} command process to run
 * @param {string[]} args commandline arguments
 * @returns {Promise<void>} promise
 */
const runCommand = (command, args) => {
	const cp = require("child_process");
	return new Promise((resolve, reject) => {
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

const npmGlobalRoot = () => {
	const cp = require("child_process");
	return new Promise((resolve, reject) => {
		const command = cp.spawn("npm", ["root", "-g"]);
		command.on("error", error => reject(error));
		command.stdout.on("data", data => resolve(data.toString()));
		command.stderr.on("data", data => reject(data));
	});
};

const runWhenInstalled = (packages, pathForCmd, ...args) => {
	const currentPackage = require(pathForCmd);
	const func = currentPackage.default;
	if (typeof func !== "function") {
		throw new Error(`@webpack-cli/${packages} failed to export a default function`);
	}
	return func(...args);
};

module.exports = function promptForInstallation(packages, ...args) {
	const nameOfPackage = "@webpack-cli/" + packages;
	let packageIsInstalled = false;
	let pathForCmd;
	try {
		const path = require("path");
		const fs = require("fs");
		pathForCmd = path.resolve(process.cwd(), "node_modules", "@webpack-cli", packages);
		if (!fs.existsSync(pathForCmd)) {
			const globalModules = require("global-modules");
			pathForCmd = globalModules + "/@webpack-cli/" + packages;
			require.resolve(pathForCmd);
		} else {
			require.resolve(pathForCmd);
		}
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

		if (packages === "init") {
			if (isYarn) {
				options.splice(1, 1); // remove '-D'
				options.splice(0, 0, "global");
			} else {
				options[1] = "-g";
			}
		}

		const commandToBeRun = `${packageManager} ${options.join(" ")}`;

		const question = `Would you like to install ${packages}? (That will run ${commandToBeRun}) (yes/NO) : `;

		console.error(`The command moved into a separate package: ${nameOfPackage}`);
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
					runCommand(packageManager, options)
						.then(_ => {
							if (packages === "init") {
								npmGlobalRoot()
									.then(root => {
										const pathtoInit = path.resolve(root.trim(), "@webpack-cli", "init");
										return pathtoInit;
									})
									.then(pathForInit => {
										return require(pathForInit).default(...args);
									})
									.catch(error => {
										console.error(error);
										process.exitCode = 1;
									});
								return;
							}

							pathForCmd = path.resolve(process.cwd(), "node_modules", "@webpack-cli", packages);
							return runWhenInstalled(packages, pathForCmd, ...args);
						})
						.catch(error => {
							console.error(error);
							process.exitCode = 1;
						});
					break;
				}
				default: {
					console.error(`${nameOfPackage} needs to be installed in order to run the command.`);
					process.exitCode = 1;
					break;
				}
			}
		});
	} else {
		return runWhenInstalled(packages, pathForCmd, ...args);
	}
};
