const fs = require('fs');
const path = require('path');
const present = require('present');
const promisedExec = require('../../shared/promisedExec');

let repoLocalPath;

module.exports = (req, res, repoPath) => {
    repoLocalPath = repoPath;

    return promisedExec('ruby ../../../private/scripts/git_stats/commits_by_date_per_author.rb ' + repoLocalPath, { cwd: __dirname }, stdout => {
        res.render('code-stats-contributors', {
            data: stdout
        });
    });
};