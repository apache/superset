<!--
Stock comments the SIP steward workflow posts as github-actions.
Each section starts with a <!-- STAGE name --> marker; everything until the next
marker is the comment, posted verbatim after placeholders are filled in.
Placeholders: {number} {title} {issue_url} {discuss_url} {vote_url} {result_url} {board_url}
A link whose URL placeholder is unknown is posted as plain text (brackets and URL dropped).
-->

<!-- STAGE numbered -->
Thanks for the proposal! This has been numbered **SIP-{number}**, and will be added to the [SIP project board]({board_url}) shortly.

The next step is a `[DISCUSS] SIP-{number}: {title}` thread on the `dev@superset.apache.org` mailing list, linking back to this issue. If you're not subscribed yet, send an email to `dev-subscribe@superset.apache.org` first, or the list won't accept your post. The full process is in [SIP-0](https://github.com/apache/superset/issues/5602).

<!-- STAGE in-discussion -->
A [DISCUSS thread]({discuss_url}) for this SIP is open on the `dev@` mailing list, so it's been labeled `sip:in-discussion` and should be moved to the appropriate column on the [Project board]({board_url}). Please keep the conversation going, and update this issue if the proposal changes along the way.

Once the discussion settles, a committer can call a `[VOTE]` on the list. Per [SIP-0](https://github.com/apache/superset/issues/5602), it takes 3 binding +1 votes from committers, and no vetoes.

<!-- STAGE voting -->
A [VOTE thread]({vote_url}) for this SIP is open on the `dev@` mailing list, so it's been labeled `sip:voting` and should be moved to the appropriate column on the [Project board]({board_url}). Once the voting period closes, whoever called the vote should send a `[RESULT][VOTE]` email to the list with the tally.

<!-- STAGE approved -->
The [VOTE thread]({vote_url}) for this SIP has [passed]({result_url}), and since the SIP is approved, the Issue has served its purpose, and will be closed. Congratulations, and please move this item forward on the [Project board]({board_url}) as implementation proceeds. Thank you!
