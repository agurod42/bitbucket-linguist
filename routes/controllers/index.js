"use strict";

const fs = require('fs');
const locks = require('locks');
const md5 = require('md5');
const path = require('path');
const present = require('present');
const promisedExec = require('../shared/promisedExec');

const LOCK_TIMEOUT = 120000; // 2 mins

let httpClient;
let mutex = {};

module.exports = {

    overview: (addon, req, res) => {
        handleRequest(addon, req, res, require('./overview'))
    },

};

function handleRequest(addon, req, res, handler) {

    httpClient = addon.httpClient(req);

    try {
        oauthTokenFromJWT()
            .then(oauthToken => cloneOrPullRepo(req.query.repoPath, oauthToken))
            .then(repoLocalPath => handler(addon, req, res, repoLocalPath))
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

    if (!mutex[repoLocalPath]) {
        mutex[repoLocalPath] = locks.createMutex();
        console.log('mutex (' + repoLocalPath + ') created');
    }

    if (fs.existsSync(repoLocalPath)) {
        return pullRepo(repoUri, repoLocalPath);
    }
    else {
        return cloneRepo(repoUri, repoLocalPath);
    }
}

function cloneRepo(repoUri, repoLocalPath) {
    return new Promise((resolve, reject) => {

        mutex[repoLocalPath].timedLock(LOCK_TIMEOUT, (err) => {
            if (err) reject(err);

            let t = present();
            console.log('cloneRepo (' + repoLocalPath + ') has started');

            let cloneRepoPromise = promisedExec(
                'git clone ' + repoUri + ' ' + repoLocalPath, 
                {}, 
                stdout => {
                    mutex[repoLocalPath].unlock();
                    console.log('cloneRepo (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');
                    resolve(repoLocalPath);
                }
            );

            cloneRepoPromise.catch(reject);

        });

    });
}

function pullRepo(repoUri, repoLocalPath) {
    return new Promise((resolve, reject) => {

        mutex[repoLocalPath].timedLock(LOCK_TIMEOUT, (err) => {
            if (err) reject(err);

            let t = present();
            console.log('pullRepo (' + repoLocalPath + ') has started');

            let pullRepoPromise = promisedExec(
                'git pull ' + repoUri, 
                { cwd: repoLocalPath }, 
                stdout => {
                    mutex[repoLocalPath].unlock();
                    console.log('pullRepo (' + repoLocalPath + ') has finished: ' + (present() - t) + ' ms');
                    resolve(repoLocalPath);
                }
            );

            pullRepoPromise.catch(reject);

        });

    });
}