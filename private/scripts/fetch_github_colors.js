const fs = require('fs')
const https = require('https')

https.get('https://raw.githubusercontent.com/github/linguist/master/lib/linguist/languages.yml', response => {
    let body = ''
    let languages = {}

    response.on('data', chunk => body += chunk)
    response.on('end', () => {
        // parse file contents
        let pendingLang = null;

        body.split('\n').forEach(line => {
            
            if (/^\S/.test(line) && line.endsWith(':')) {
                pendingLang = line.substr(0, line.length - 1)
            }
            
            if (pendingLang && line.includes('color:')) {
                let color = line.split(':')[1].trim().replace(/"/g, '')
                languages[pendingLang] = color
                pendingLang = null
            }

        })

        // save language object to a file
        fs.writeFileSync('./private/data/colors.json', JSON.stringify(languages, null, 4))
    })
})