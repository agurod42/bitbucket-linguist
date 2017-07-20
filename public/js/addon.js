// Bitbucket Connect also supports a client side library - AP (for "Atlassian Plugins") - that
// allows you to interact with the host application. For example, you can make authenticated
// requests to the Bitbucket REST API ...

AP.require('request', function(request) {
    request({
        url: '/1.0/user/',
        success: function(data) {
            $('#displayName')
                .text(data.user.display_name)
                .next('.loading').hide();
        }
    });
});

// ... and set cookies (browser security policies often prevent this from being done in iframes).

var COOKIE_NAME = 'example-visits';

AP.require('cookie', function(cookie) {
    cookie.read(COOKIE_NAME, function(visits) {
        visits = (visits ? parseInt(visits) : 0) + 1;
        cookie.save(COOKIE_NAME, visits, 30);
        $('#pageVisits')
            .text(visits)
            .next('.loading').hide();
    });
});

