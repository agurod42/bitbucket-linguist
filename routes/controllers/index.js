"use strict";

let _httpClient;

module.exports = {
    overview: (addon, req, res) => {
        handleRequest(addon, req, res, require('./overview'))
    },
};

function handleRequest(addon, req, res, handler) {
    _httpClient = addon.httpClient(req);
    try {
        oauthTokenFromJWT()
            .then(oauthToken => handler(_httpClient, oauthToken, req.query, res))
            .catch((err) => {
                console.log(err);
                res.sendStatus(500);
            });
    } 
    catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
}

function oauthTokenFromJWT() {
    return new Promise((resolve, reject) => {
        _httpClient.post(
            {
                url: '/site/oauth2/access_token',
                multipartFormData: { grant_type: 'urn:bitbucket:oauth2:jwt' }
            },
            (err, res, body) => {
                if (err) {
                    reject(err);
                }
                else {
                    console.log(body);
                    resolve(JSON.parse(body).access_token);
                }
            }
        );
    });
}
