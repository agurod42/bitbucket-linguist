"use strict";

const fs = require('fs');
const md5 = require('md5');
const path = require('path');
const present = require('present');
const promisedExec = require('../shared/promisedExec');

let httpClient;

module.exports = {

    overview: (addon, req, res) => {
        handleRequest(addon, req, res, require('./overview'))
    },

    contributors: (addon, req, res) => {
        handleRequest(addon, req, res, require('./contributors'))
    },

};

function handleRequest(addon, req, res, handler) {

    httpClient = addon.httpClient(req);

    try {
        let codeStats = {};

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