"use strict";

const exec = require('child_process').exec;
const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const util = require('util');

const DEFAULT_LANG_COLOR = '#CCCCCC';

let httpClient;

module.exports = (app, addon) => {
    
    //healthcheck route used by micros to ensure the addon is running.
    app.get('/healthcheck', (req, res) => {
        res.send(200);
    });

    // Root route. This route will redirect to the add-on descriptor: `atlassian-connect.json`.
    app.get('/', (req, res) => {
        res.format({
            // If the request content-type is text-html, it will decide which to serve up
            'text/html': () => {
                res.redirect('/atlassian-connect.json');
            },
            // This logic is here to make sure that the `atlassian-connect.json` is always
            // served up when requested by the host
            'application/json': () => {
                res.redirect('/atlassian-connect.json');
            }
        });
    });

    // This route will be targeted by iframes rendered by Bitbucket. It renders a simple template
    // with two pieces of data:
    //
    //   1. the repository path (passed in the query string via a context parameter)
    //   2. the user who installed the add-on's display name (retrieved from Bitbucket via REST)

    app.get('/code-stats-overview', addon.authenticate(), (req, res) => {

        // the call to addon.authenticate() above verifies the JWT token provided by Bitbucket
        // in the iframe URL

        httpClient = addon.httpClient(req);
        
        try {
            let codeStats = {};

            oauthTokenFromJWT()
                .then(oauthToken => cloneOrPullRepo(req.query.repoPath, oauthToken))
                .then(repoLocalPath => fetchLanguages(repoLocalPath, codeStats))
                .then(repoLocalPath => {
                    res.render('code-stats-overview', { codeStats: codeStats });
                })
                .catch(err => {
                    console.log(err);
                    res.sendStatus(501);
                });
        } 
        catch (e) {
            console.log(e);
            res.sendStatus(500);
        }
    });

    // This route will handle webhooks from repositories this add-on is installed for.
    // Webhook subscriptions are managed in the `modules.webhooks` section of
    // `atlassian-connect.json`

    app.post('/webhook', addon.authenticate(), (req, res) => {

        // log the webhook payload
        console.log(util.inspect(req.body, {
            colors:true,
            depth:null
        }));
        res.send(204);

    });

    // Add any additional route handlers you need for views or REST resources here...

};

function oauthTokenFromJWT() {
    return new Promise((resolve, reject) => {
        httpClient.post(
            {
                url: '/site/oauth2/access_token',
                multipartFormData: { grant_type: 'urn:bitbucket:oauth2:jwt' }
            },
            function (err, res, body) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(JSON.parse(body).access_token);
                }
            }
        );
    });
}

function cloneOrPullRepo(repoPath, oauthToken) {
    let repoUri = 'https://x-token-auth:' + oauthToken + '@bitbucket.org/' + repoPath + '.git';
    let repoLocalPath = path.resolve(__dirname, '../tmp/', md5(repoPath));   

    if (fs.existsSync(repoLocalPath)) {
        return pullRepo(repoUri, repoLocalPath);
    }
    else {
        return cloneRepo(repoUri, repoLocalPath);
    }
}

function cloneRepo(repoUri, repoLocalPath) {
    return promisedExec('git clone ' + repoUri + ' ' + repoLocalPath, {}, stdout => {
        return repoLocalPath;
    });
}

function pullRepo(repoUri, repoLocalPath) {
    return promisedExec('git pull ' + repoUri, { cwd: repoLocalPath }, stdout => {
        return repoLocalPath;
    });
}

}

function fetchLanguages(repoLocalPath, codeStats) {
    return promisedExec('linguist ' + repoLocalPath, {}, stdout => {
        let lines = stdout.trim().split('\n');
        let languagesColors = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../private/data/colors.json')));
        
        codeStats.languages = [];
        
        for (var i in lines) {
            let aux = lines[i].split(/\s+/);
            codeStats.languages.push({
                lang: aux[1],
                langColor: languagesColors[aux[1]] || DEFAULT_LANG_COLOR,
                percent: aux[0]
            });
        }

        return repoLocalPath;
    });
}

function promisedExec(command, opts, stdoutCallback) {
    return new Promise((resolve, reject) => {
        exec(command, opts, (err, stdout) => {
            if (err) {
                reject(err);
            }
            else {
                try {
                    let stdoutCallbackResponse = stdoutCallback(stdout);
                    resolve(stdoutCallbackResponse);
                }
                catch (ex) {
                    reject(ex);
                }
            }
        });
    });
}