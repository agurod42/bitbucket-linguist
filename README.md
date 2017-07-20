# Atlassian Add-on using Express

Congratulations! You've successfully created an Atlassian Connect Add-on using
the Express web application framework.

# Installation

1. Install [git], [node], [npm] \(2.7.5+) and [ngrok].
2. Run `npm install`.
3. Add your Bitbucket credentials to `credentials.json`.
4. Run `ngrok http 3000` and take note of the proxy's `https://..` base url.
5. Run `AC_LOCAL_BASE_URL=https://THE_NGROK_BASE_URL node app.js` from the
repository root.

# Development loop

You can manually install/update/uninstall your add-ons from
`https://bitbucket.org/account/user/USERNAME/addon-management`.

[git]: http://git-scm.com/
[node]: https://nodejs.org/
[npm]: https://github.com/npm/npm#super-easy-install
[ngrok]: https://ngrok.com/

