"use strict";

const fs = require('fs');
const path = require('path');
const present = require('present');
const promisedExec = require('../../shared/promisedExec');

const DEFAULT_LANG_COLOR = '#CCCCCC';
const LANG_COLORS_FILE = '../../../private/data/colors.json';

let repoLocalPath;

let codeStats = {};

module.exports = (addon, req, res, repoPath) => {
    repoLocalPath = repoPath;

    return new Promise((resolve, reject) => {
        let fetchStatsPromise = fetchStats();
        let fetchLanguagesPromise = fetchLanguages();
        
        Promise
            .all([fetchStatsPromise, fetchLanguagesPromise])
            .then(values => {
                res.render('code-stats-overview', { 
                    codeStats: codeStats,
                    repoPath: req.query.repoPath
                });

                resolve();
            })
            .catch(reject);
    });
};

function fetchStats() {
    return new Promise((resolve, reject) => {
        let fetchCommitCountPromise = fetchCommitCount();
        let fetchContributorsPromise = fetchContributors();

        Promise
            .all([fetchCommitCountPromise, fetchContributorsPromise])
            .then(values => {
                resolve();
            })
            .catch(reject);
    });
}

function fetchCommitCount() {
    let t = present();
    console.log('fetchCommitCount (' + repoLocalPath + ') has started');

    // https://stackoverflow.com/questions/677436/how-to-get-the-git-commit-count#comment7093558_4061706
    return promisedExec('git rev-list --count master', { cwd: repoLocalPath }, stdout => {
        codeStats.commitCount = parseInt(stdout.trim());

        console.log('fetchCommitCount (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');
    });
}

function fetchContributors() {
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
    });
}

function fetchLanguages() {
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
    });
}