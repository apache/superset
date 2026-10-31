---
title: Guideline on AI-assisted PR
sidebar_position: 3
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Guideline on AI-assisted PRs

Thank you for your contribution to Superset!

In the age of AI, code and tokens are cheap. People time is valuable. A PR from a new contributor is mostly valuable to Superset not for the code itself but for the fact that it brings on a new curious, caring contributor who can grow with the project.

Reviewer time is the Superset project's most precious resource. By reviewing, we are investing in you, your setup, and your skills, hoping to build a relationship and maybe even cultivate a new Committer.

It does not make sense for us to engage with one-off contributions that are 100% AI. We have AI tools too and could just solve the issue ourselves that way! If you are not willing to set up a development environment and test your changes locally, please do not send a PR.

To that end, before submitting a PR, make sure:

1. If the issue is labeled good-first-issue, you have requested to work on it and been assigned
2. You have checked for existing open PRs that do the same thing
3. You have deployed the changes in your own Superset environment and tested the new behavior directly as a user.
4. If there's any resulting change in the UI, you include before & after screenshots from your manual testing of the current behavior vs. your fix
5. You understand all of the code you are submitting
6. You get pre-commit checks passing before a committer reviews
7. If you are using AI, also use that AI to conduct an adversarial review of your code and address anything it finds
8. You write in your own voice in the PR, at least a few sentences. If you then want to include AI text, that can follow, with a clear disclaimer like "Here's the AI summary of the changes, I reviewed this and agree with it:"
If your PR does not indicate you've done these things, it may be tagged as lacks-human-authorship and closed.
