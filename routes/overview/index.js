
const exec = require('child_process').exec;
const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const present = require('present');

const DEFAULT_LANG_COLOR = '#CCCCCC';
const LANG_COLORS_FILE = '../../private/data/colors.json';

let httpClient;

module.exports = (addon, req, res) => {

    httpClient = addon.httpClient(req);

    try {
        let codeStats = {};

        oauthTokenFromJWT()
            .then(oauthToken => cloneOrPullRepo(req.query.repoPath, oauthToken))
            .then(repoLocalPath => fetchStats(repoLocalPath, codeStats))
            .then(repoLocalPath => fetchLanguages(repoLocalPath, codeStats))
            .then(repoLocalPath => {
                res.render('code-stats-overview', { 
                    codeStats: codeStats,
                    repoPath: req.query.repoPath
                });
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

}

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
    let repoLocalPath = path.resolve(__dirname, '../../tmp/', md5(repoPath));   

    if (fs.existsSync(repoLocalPath)) {
        return pullRepo(repoUri, repoLocalPath);
    }
    else {
        return cloneRepo(repoUri, repoLocalPath);
    }
}

function cloneRepo(repoUri, repoLocalPath) {
    let t = present();
    console.log('cloneRepo (' + repoLocalPath + ') has started');

    return promisedExec('git clone ' + repoUri + ' ' + repoLocalPath, {}, stdout => {
        console.log('cloneRepo (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');
        return repoLocalPath;
    });
}

function pullRepo(repoUri, repoLocalPath) {
    let t = present();
    console.log('pullRepo (' + repoLocalPath + ') has started');

    return promisedExec('git pull ' + repoUri, { cwd: repoLocalPath }, stdout => {
        console.log('pullRepo (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');
        return repoLocalPath;
    });
}

function fetchStats(repoLocalPath, codeStats) {
    return new Promise((resolve, reject) => {
        let fetchCommitCountPromise = fetchCommitCount(repoLocalPath, codeStats);
        let fetchContributorsPromise = fetchContributors(repoLocalPath, codeStats);

        Promise
            .all([fetchCommitCountPromise, fetchContributorsPromise])
            .then(values => {
                resolve(repoLocalPath);
            })
            .catch(reject);
    });
}

function fetchCommitCount(repoLocalPath, codeStats) {
    let t = present();
    console.log('fetchCommitCount (' + repoLocalPath + ') has started');

    // https://stackoverflow.com/questions/677436/how-to-get-the-git-commit-count#comment7093558_4061706
    return promisedExec('git rev-list --count master', { cwd: repoLocalPath }, stdout => {
        codeStats.commitCount = parseInt(stdout.trim());

        console.log('fetchCommitCount (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');

        return repoLocalPath;
    });
}

function fetchContributors(repoLocalPath, codeStats) {
    let t = present();
    console.log('fetchContributors (' + repoLocalPath + ') has started');

    // https://stackoverflow.com/a/33858300/3879872
    return promisedExec('git log --all --format=\'%aE\' | sort -u', { cwd: repoLocalPath }, stdout => {
        let lines = stdout.trim().split('\n');

        codeStats.contributors = [];

        for (var i in lines) {
            codeStats.contributors.push(lines[i]);
        }

        codeStats.singleContributor = codeStats.contributors.length == 1;

        console.log('fetchContributors (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');

        return repoLocalPath;
    });
}

function fetchLanguages(repoLocalPath, codeStats) {
    let t = present();
    console.log('fetchLanguages (' + repoLocalPath + ') has started');

    return promisedExec('linguist ' + repoLocalPath, {}, stdout => {
        let lines = stdout.trim().split('\n');
        let languagesColors = JSON.parse(fs.readFileSync(path.resolve(__dirname, LANG_COLORS_FILE)));
        
        codeStats.languages = [];
        
        for (var i in lines) {
            let aux = lines[i].split(/\s+/);
            codeStats.languages.push({
                lang: aux[1],
                langColor: languagesColors[aux[1]] || DEFAULT_LANG_COLOR,
                percent: aux[0]
            });
        }

        console.log('fetchLanguages (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');

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