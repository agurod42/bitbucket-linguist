const exec = require('child_process').exec;

module.exports = (command, opts, stdoutCallback) => {
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