const isDev =
    process.env.NODE_ENV === 'dev' ||
    process.env.NODE_ENV === 'test';

function debugLog(...args){
    if(isDev){
        console.log(...args);
    }
}

module.exports = { debugLog };