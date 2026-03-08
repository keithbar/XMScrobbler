const fs = require('fs');
const path = require('path');

const isDev =
    process.env.NODE_ENV === 'dev' ||
    process.env.NODE_ENV === 'test';

function debugLog(filename, string, err = null){
    if(filename === 'error'){
        console.error(string, err);
    }
    // else if(isDev){
    //     console.log(string);
    // }

    if(isDev){
        try{
            const now = new Date().toLocaleString();
            fs.appendFile(path.join(__dirname, '../logs', filename + '.log'), 
                now + ': ' + string + (err ? err.message : '') + '\n', 
                (err) => {
                    if(err) console.error('Error writing log files.', err);
                }
            );
        }
        catch(err){
            console.error('Error writing log files.', err);
        }
    }
}

module.exports = { debugLog };