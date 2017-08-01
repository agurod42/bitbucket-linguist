"use strict";

const fs = require('fs');
const path = require('path');
const present = require('present');
const promisedExec = require('../../shared/promisedExec');

let httpClient;
let repoLocalPath;

let contributorData;
let repoData;

module.exports = (addon, req, res, repoPath) => {
    httpClient = addon.httpClient(req);
    repoLocalPath = repoPath;

    return new Promise((resolve, reject) => {
        let fetchContributorsDataPromise = fetchContributorsData();
        let fetchRepoDataPromise = fetchRepoData(req.query.repoPath);

        Promise
            .all([fetchContributorsDataPromise, fetchRepoDataPromise])
            .then(values => {
                res.render('code-stats-contributors', {
                    data: contributorData,
                    repo: repoData
                });

                resolve();
            })
            .catch(reject);
    });
};

function fetchContributorsData() {
    let t = present();
    console.log('fetchContributorsData (' + repoLocalPath + ') has started');

    return promisedExec('ruby ../../../private/scripts/git_stats/commits_by_date_per_author.rb ' + repoLocalPath, { cwd: __dirname }, stdout => {
        contributorData = stdout;

        console.log('fetchContributorsData (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');
    });
}

function fetchRepoData(repoRemotePath) {
    let t = present();
    console.log('fetchRepoData (' + repoLocalPath + ') has started');
    
    return new Promise((resolve, reject) => {
        httpClient.get(
            '/api/2.0/repositories/' + repoRemotePath,
            function (err, res, body) {
                if (err) {
                    reject(err);
                }
                else {
                    var response = JSON.parse(body);
                    
                    repoData = {
                        name: response.name,
                        path: repoRemotePath,
                        owner: {
                            username: response.owner.username,
                            name: response.owner.display_name
                        },
                        project: {
                            key: response.project ? response.project.key : undefined,
                            name: response.project ? response.project.name : undefined
                        }
                    };

                    console.log('fetchRepoData (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');

                    resolve();
                }
            }
        );
    });
}