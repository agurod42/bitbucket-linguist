const exec = require('child_process').exec;
const fs = require('fs');
const git = require('nodegit');
const md5 = require('md5');
const path = require('path');
const util = require('util');

const DEFAULT_LANG_COLOR = '#333';

module.exports = function (app, addon) {
    
    //healthcheck route used by micros to ensure the addon is running.
    app.get('/healthcheck', function(req, res) {
        res.send(200);
    });

    // Root route. This route will redirect to the add-on descriptor: `atlassian-connect.json`.
    app.get('/', function (req, res) {
        res.format({
            // If the request content-type is text-html, it will decide which to serve up
            'text/html': function () {
                res.redirect('/atlassian-connect.json');
            },
            // This logic is here to make sure that the `atlassian-connect.json` is always
            // served up when requested by the host
            'application/json': function () {
                res.redirect('/atlassian-connect.json');
            }
        });
    });

    // This route will be targeted by iframes rendered by Bitbucket. It renders a simple template
    // with two pieces of data:
    //
    //   1. the repository path (passed in the query string via a context parameter)
    //   2. the user who installed the add-on's display name (retrieved from Bitbucket via REST)

    app.get('/bitbucket-code-stats', addon.authenticate(), function (req, res) {

        // the call to addon.authenticate() above verifies the JWT token provided by Bitbucket
        // in the iframe URL
        
        try {
            oauthTokenFromJWT(
                addon, 
                req, 
                function (oauthToken) {
                    cloneOrPullRepo(
                        req.query.repoPath,
                        oauthToken,
                        function (repoLocalPath) {
                            exec('linguist ' + repoLocalPath, function (err, stdout) {
                                if (err) {
                                    console.log(err);
                                    res.sendStatus(501);
                                }
                                else {
                                    let lines = stdout.trim().split('\n');
                                    let languages = [];
                                    let languagesColors = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../private/data/colors.json')));

                                    for (var i in lines) {
                                        let aux = lines[i].split(/\s+/);
                                        languages.push({
                                            lang: aux[1],
                                            langColor: languagesColors[aux[1]] || DEFAULT_LANG_COLOR,
                                            percent: aux[0]
                                        });
                                    }
                                    
                                    res.render('bitbucket-code-stats', { languages: languages });
                                }
                            });
                        },
                        function (err) {
                            console.log(err);
                            res.sendStatus(501);
                        }
                    );
                },
                function (err) {
                    console.log(err);
                    res.sendStatus(501);
                }
            );
        } 
        catch (e) {
            console.log(e);
            res.sendStatus(500);
        }
    });

    // This route will handle webhooks from repositories this add-on is installed for.
    // Webhook subscriptions are managed in the `modules.webhooks` section of
    // `atlassian-connect.json`

    app.post('/webhook', addon.authenticate(), function (req, res) {

        // log the webhook payload
        console.log(util.inspect(req.body, {
            colors:true,
            depth:null
        }));
        res.send(204);

    });

    // Add any additional route handlers you need for views or REST resources here...

};

function oauthTokenFromJWT(addon, req, successCb, errorCb) {
    // $ curl -X POST -H "Authorization: JWT {jwt_token}" https://bitbucket.org/site/oauth2/access_token -d grant_type=urn:bitbucket:oauth2:jwt
    addon.httpClient(req).post(
        {
            url: "/site/oauth2/access_token",
            multipartFormData: { grant_type: "urn:bitbucket:oauth2:jwt" }
        },
        function (err, res, body) {
            if (err) {
                errorCb(err);
            }
            else {
                var data = JSON.parse(body);
                successCb(data.access_token);
            }
        }
    );
}

function cloneOrPullRepo(repoPath, oauthToken, successCb, errorCb) {
    let repoUri = 'https://x-token-auth:' + oauthToken + '@bitbucket.org/' + repoPath + '.git';
    let repoLocalPath = path.resolve(__dirname, '../tmp/', md5(repoUri));   

    if (fs.existsSync(repoLocalPath)) {
        pullRepo(repoUri, repoLocalPath, successCb, errorCb);
    }
    else {
        cloneRepo(repoUri, repoLocalPath, successCb, errorCb);
    }
}

function cloneRepo(repoUri, repoLocalPath, successCb, errorCb) {
    git
        .Clone(repoUri, repoLocalPath, {
            fetchOpts: {
                callbacks: {
                    certificateCheck: 0,
                }
            }
        })
        .then(function (repo) {
            // clone succeed
            successCb(repoLocalPath);
        })
        .catch(function (err) {
            errorCb(err);
        });
}

function pullRepo(repoUri, repoLocalPath, successCb, errorCb) {
    var repoLocalWorkingCopy;

    git
        .Repository
        .open(repoLocalPath)
        .then(function (repo) {
            repoLocalWorkingCopy = repo;
            return repo.fetchAll({
                callbacks: {
                    certificateCheck: 0,
                }
            })
        })
        // Now that we're finished fetching, go ahead and merge our local branch
        // with the new one
        .then(function () {
            repoLocalWorkingCopy.mergeBranches('master', 'origin/master');
            // pull succeed
            successCb(repoLocalPath);
        })
        .catch(function (err) {
            errorCb(err);
        });
}