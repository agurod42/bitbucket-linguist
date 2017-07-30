"use strict";

const controllers = require('./controllers');
const util = require('util');

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

    app.get('/code-stats-contributors', addon.authenticate(), (req, res) => {

        controllers.contributors(addon, req, res);

    });

    app.get('/code-stats-overview', addon.authenticate(), (req, res) => {

        // the call to addon.authenticate() above verifies the JWT token provided by Bitbucket
        // in the iframe URL

        controllers.overview(addon, req, res);

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