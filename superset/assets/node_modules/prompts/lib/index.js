'use strict';

const prompts = require('./prompts');

const passOn = ['suggest', 'format', 'onState', 'validate', 'onRender'];
const noop = () => {};

/**
 * Prompt for a series of questions
 * @param {Array|Object} questions Single question object or Array of question objects
 * @returns {Object} Object with values from user input
 */
async function prompt(questions=[], { onSubmit=noop, onCancel=noop }={}) {
  const answers = {};
  questions = [].concat(questions);
  let answer, question, quit, name, type;

  for (question of questions) {
    ({ name, type } = question);

    // if property is a function, invoke it unless it's a special function
    for (let key in question) {
      if (passOn.includes(key)) continue;
      let value = question[key];
      question[key] = typeof value === 'function' ? await value(answer, { ...answers }, question) : value;
    }

    if (typeof question.message !== 'string') {
      throw new Error('prompt message is required');
    }

    // update vars in case they changed
    ({ name, type } = question);

    // skip if type is a falsy value
    if (!type) continue;

    if (prompts[type] === void 0) {
      throw new Error(`prompt type (${type}) is not defined`);
    }

    try {
      // Get the injected answer if there is one or prompt the user
      answer = prompt._injected ? getInjectedAnswer(prompt._injected) : await prompts[type](question);
      answers[name] = answer = question.format ? await question.format(answer, answers) : answer;
      quit = await onSubmit(question, answer, answers);
    } catch (err) {
      quit = !(await onCancel(question, answers));
    }

    if (quit) return answers;
  }

  return answers;
}

function getInjectedAnswer(injected) {
  const answer = injected.shift();
    if (answer instanceof Error) {
      throw answer;
    }

    return answer;
}

function inject(answers) {
  prompt._injected = (prompt._injected || []).concat(answers)
}

module.exports = Object.assign(prompt, { prompt, prompts, inject });
