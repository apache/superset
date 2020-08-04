#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const getStdin = require("get-stdin");
const validators = require("./validators");

const SPECIAL_RULES_URL =
  "https://github.com/prettier/eslint-config-prettier#special-rules";

if (module === require.main) {
  if (process.argv.length > 2 || process.stdin.isTTY) {
    console.error(
      [
        "This tool checks whether an ESLint configuration contains rules that are",
        "unnecessary or conflict with Prettier. It’s supposed to be run like this:",
        "",
        "  npx eslint --print-config path/to/main.js | npx eslint-config-prettier-check",
        "  npx eslint --print-config test/index.js | npx eslint-config-prettier-check",
        "",
        "Exit codes:",
        "",
        "0: No automatically detectable problems found.",
        "1: Unexpected error.",
        "2: Conflicting rules found.",
        "",
        "For more information, see:",
        "https://github.com/prettier/eslint-config-prettier#cli-helper-tool",
      ].join("\n")
    );
    process.exit(1);
  }

  getStdin()
    .then((string) => {
      const result = processString(string);
      if (result.stderr) {
        console.error(result.stderr);
      }
      if (result.stdout) {
        console.error(result.stdout);
      }
      process.exit(result.code);
    })
    .catch((error) => {
      console.error("Unexpected error", error);
      process.exit(1);
    });
}

function processString(string) {
  let config;
  try {
    config = JSON.parse(string);
  } catch (error) {
    return {
      stderr: `Failed to parse JSON:\n${error.message}`,
      code: 1,
    };
  }

  if (
    !(
      Object.prototype.toString.call(config) === "[object Object]" &&
      Object.prototype.toString.call(config.rules) === "[object Object]"
    )
  ) {
    return {
      stderr: `Expected a \`{"rules: {...}"}\` JSON object, but got:\n${string}`,
      code: 1,
    };
  }

  // This used to look at "files" in package.json, but that is not reliable due
  // to an npm bug. See:
  // https://github.com/prettier/eslint-config-prettier/issues/57
  const allRules = Object.assign(
    Object.create(null),
    ...fs
      .readdirSync(path.join(__dirname, ".."))
      .filter((name) => !name.startsWith(".") && name.endsWith(".js"))
      .map((ruleFileName) => require(`../${ruleFileName}`).rules)
  );

  const regularRules = filterRules(
    allRules,
    (ruleName, value) => value === "off"
  );
  const optionsRules = filterRules(
    allRules,
    (ruleName, value) => value === 0 && ruleName in validators
  );
  const specialRules = filterRules(
    allRules,
    (ruleName, value) => value === 0 && !(ruleName in validators)
  );

  const flaggedRules = Object.keys(config.rules)
    .map((ruleName) => {
      const value = config.rules[ruleName];
      const arrayValue = Array.isArray(value) ? value : [value];
      const level = arrayValue[0];
      const options = arrayValue.slice(1);
      const isOff = level === "off" || level === 0;
      return !isOff && ruleName in allRules ? { ruleName, options } : null;
    })
    .filter(Boolean);

  const regularFlaggedRuleNames = filterRuleNames(
    flaggedRules,
    (ruleName) => ruleName in regularRules
  );
  const optionsFlaggedRuleNames = filterRuleNames(
    flaggedRules,
    (ruleName, options) =>
      ruleName in optionsRules && !validators[ruleName](options)
  );
  const specialFlaggedRuleNames = filterRuleNames(
    flaggedRules,
    (ruleName) => ruleName in specialRules
  );

  if (
    regularFlaggedRuleNames.length === 0 &&
    optionsFlaggedRuleNames.length === 0
  ) {
    const baseMessage =
      "No rules that are unnecessary or conflict with Prettier were found.";

    const message =
      specialFlaggedRuleNames.length === 0
        ? baseMessage
        : [
            baseMessage,
            "",
            "However, the following rules are enabled but cannot be automatically checked. See:",
            SPECIAL_RULES_URL,
            "",
            printRuleNames(specialFlaggedRuleNames),
          ].join("\n");

    return {
      stdout: message,
      code: 0,
    };
  }

  const regularMessage = [
    "The following rules are unnecessary or might conflict with Prettier:",
    "",
    printRuleNames(regularFlaggedRuleNames),
  ].join("\n");

  const optionsMessage = [
    "The following rules are enabled with options that might conflict with Prettier. See:",
    SPECIAL_RULES_URL,
    "",
    printRuleNames(optionsFlaggedRuleNames),
  ].join("\n");

  const specialMessage = [
    "The following rules are enabled but cannot be automatically checked. See:",
    SPECIAL_RULES_URL,
    "",
    printRuleNames(specialFlaggedRuleNames),
  ].join("\n");

  const message = [
    regularFlaggedRuleNames.length === 0 ? null : regularMessage,
    optionsFlaggedRuleNames.length === 0 ? null : optionsMessage,
    specialFlaggedRuleNames.length === 0 ? null : specialMessage,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    stdout: message,
    code: 2,
  };
}

function filterRules(rules, fn) {
  return Object.keys(rules)
    .filter((ruleName) => fn(ruleName, rules[ruleName]))
    .reduce((obj, ruleName) => {
      obj[ruleName] = true;
      return obj;
    }, Object.create(null));
}

function filterRuleNames(rules, fn) {
  return rules
    .filter((rule) => fn(rule.ruleName, rule.options))
    .map((rule) => rule.ruleName);
}

function printRuleNames(ruleNames) {
  return ruleNames
    .slice()
    .sort()
    .map((ruleName) => `- ${ruleName}`)
    .join("\n");
}

exports.processString = processString;
