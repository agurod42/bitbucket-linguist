"use strict";

const crypto = require('crypto');
const fs = require('fs-extra');
const present = require('present');
const promisedExec = require('../../shared/promisedExec');
const tmp = require('tmp');

const DATA_FOLDER = `${__dirname}/../../../data`;
const DEFAULT_LANG_COLOR = '#CCCCCC';
const LANG_COLORS_FILE = `${__dirname}/../../../private/data/colors.json`;

let _cachePath;
let _httpClient;

module.exports = (addon, httpClient, oauthToken, query, res) => {
    _httpClient = httpClient;

    return  fetchRepoMetadata(query.repoPath)
            .then((repo) => new Promise((resolve, reject) => {
                _cachePath = `${DATA_FOLDER}/${query.repoPath}/${crypto.createHash('md5').update(repo.updated_on).digest('hex')}`;
                fs.ensureDirSync(_cachePath);

                let branchesCountPromise = fetchBranchesCount(query.repoPath);
                let commitsCountPromise = fetchCommitsCount(query.repoPath, repo.mainbranch.name);
                let languagesPromise = fetchLanguages(query.repoPath, oauthToken);
                
                Promise
                    .all([
                        branchesCountPromise,
                        commitsCountPromise, 
                        languagesPromise
                    ])
                    .catch(reject)
                    .then((values) => {
                        res.render('code-stats-overview', { 
                            codeStats: {
                                branchesCount: values[0],
                                branchesCountPlural: values[0].length > 1,
                                commitsCount: values[1],
                                commitsCountPlural: values[1].length > 1,
                                languages: values[2]
                            },
                            repoPath: query.repoPath
                        });

                        resolve();
                    });
            }));
};

function fetchRepoMetadata(repoPath) {
    return new Promise((resolve, reject) => {
        _httpClient.get(
            {
                url: `/api/2.0/repositories/${repoPath}/`,
                json: true
            },
            (err, res, body) => {
                if (err) reject(err);
                else resolve(body);
            }
        );
    });
}

function fetchBranchesCount(repoPath) {
    let branchesFile = `${_cachePath}/branches.json`;
    if (fs.existsSync(branchesFile)) {
        let branches = fs.readJSONSync(branchesFile);
        return Promise.resolve(branches.size || branches.values.length);
    }
    else {
        let t = present();
        console.log('fetchBranchesCount (' + repoPath + ') has started');

        return new Promise((resolve, reject) => {
            _httpClient.get(
                {
                    url: `/api/2.0/repositories/${repoPath}/refs/branches`,
                    json: true
                },
                (err, res, body) => {
                    if (err) reject(err);
                    else {
                        console.log('fetchBranchesCount (' + repoPath + ') has finished: ' + (present() - t) + ' ms');
                        fs.writeJSONSync(branchesFile, body);
                        resolve(body.size || body.values.length);
                    }
                }
            );
        });
    }
}

function fetchCommitsCount(repoPath, branch) {
    let commitsFile = `${_cachePath}/commits.json`;
    if (fs.existsSync(commitsFile)) {
        let commits = fs.readJSONSync(commitsFile);
        return Promise.resolve(commits.size || commits.values.length);
    }
    else {
        let t = present();
        console.log('fetchCommitsCount (' + repoPath + ') has started');

        return new Promise((resolve, reject) => {
            _httpClient.get(
                {
                    url: `/api/2.0/repositories/${repoPath}/commits/${branch}`,
                    json: true
                },
                (err, res, body) => {
                    if (err) reject(err);
                    else {
                        console.log('fetchCommitsCount (' + repoPath + ') has finished: ' + (present() - t) + ' ms');
                        fs.writeJSONSync(commitsFile, body);
                        resolve(body.size || body.values.length);
                    }
                }
            );
        });
    }
}

function fetchLanguages(repoPath, oauthToken) {
    let languagesFile = `${_cachePath}/languages.json`;
    if (fs.existsSync(languagesFile)) {
        return Promise.resolve(fs.readJSONSync(languagesFile));
    }
    else {
        return  cloneRepo(repoPath, oauthToken)
                .then(githubLinguist)
                .then((languages) => {
                    fs.writeJSONSync(languagesFile, languages);
                    return languages;
                });
    }
}

function cloneRepo(repoPath, oauthToken) {
    let t = present();
    console.log('cloneRepo (' + repoPath + ') has started');

    let repoUri = 'https://x-token-auth:' + oauthToken + '@bitbucket.org/' + repoPath + '.git';
    let repoLocalPath = tmp.dirSync().name;

    return promisedExec(
        `git clone ${repoUri} ${repoLocalPath} --depth 1`, 
        {}, 
        () => {
            console.log('cloneRepo (' + repoPath + ') has finished: ' + (present() - t) + ' ms');
            return repoLocalPath;
        }
    );
}

function githubLinguist(repoLocalPath) {
    let t = present();
    console.log('githubLinguist (' + repoLocalPath + ') has started');

    return promisedExec('github-linguist ' + repoLocalPath, {}, (stdout) => {
        let lines = stdout.trim().split('\n');
        let languagesColors = JSON.parse(fs.readFileSync(LANG_COLORS_FILE));
        let languages = [];
        
        for (var i in lines) {
            if (lines[i] != '') {
                let aux = lines[i].split(/\s+/);
                languages.push({
                    lang: aux[1],
                    langColor: languagesColors[aux[1]] || DEFAULT_LANG_COLOR,
                    percent: aux[0]
                });
            }  
        }

        console.log('githubLinguist (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');

        return languages;
    });
}
