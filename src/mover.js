const fs = require('fs');
const path = require('path');
const util = require('util');
const parser = require('fast-xml-parser');
const settings = require('electron-settings');

let cardRootPath = settings.get('card_root');

exports.validRootPath = function(dpath) {
    let isValid = fs.existsSync(path.join(dpath, 'SAMPLES'));
    return isValid;
}

const scan_dir = function(sample_file_name, scan_path) {
//    console.log('Finding usages for ' + sample_file_name + ' in ' + scan_path);
    let found = [];
    let files = fs.readdirSync(scan_path);
    files.forEach(file => {
        let file_path = path.join(scan_path, file);
        if(path.extname(file_path).toUpperCase()!=='.XML') return;
        let data = fs.readFileSync(file_path);
        if(data.indexOf(sample_file_name)>-1){
            let relative_name = path.relative(cardRootPath, file_path);
//            console.log(sample_file_name + ' used in ' + relative_name);
            found.push(relative_name);
        }

    });
    return found;
};

const usages = function(sample_file) {
    let relative_sample_file_name = path.relative(cardRootPath, sample_file);
//    console.log('finding usages for: ' + relative_sample_file_name);
    let occurences = [];
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath, 'SONGS')));
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath, 'SYNTHS')));
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath, 'KITS')));
//    console.log(JSON.stringify(occurences));
    return occurences;
};

exports.usages = usages;

// ------ ASYNC VERSIONS

const readfileP = util.promisify(fs.readFile);
const readdirP = util.promisify(fs.readdir);

const sample_occurs_in_file = async function(sample_file_name, file_path) {
    const data = await readfileP(file_path);
    if(data.indexOf(sample_file_name)>-1){
        let relative_name = path.relative(cardRootPath, file_path);
        return true;
    }
    return false;
}

const scan_dir_async = async function(sample_file_name, scan_path) {
    //    console.log('Finding usages for ' + sample_file_name + ' in ' + scan_path);
    let found = [];
    const files = await readdirP(scan_path);
    for (let file of files) {
        let file_path = path.join(scan_path, file);
        if(path.extname(file_path).toUpperCase()!=='.XML') return;
        const occurs = await sample_occurs_in_file(sample_file_name, file_path);
        if(occurs) {
            let relative_name = path.relative(cardRootPath, file_path);
            //console.log(sample_file_name + ' used in ' + relative_name);
            found.push(relative_name);
        }
    }
    return found;
};

const usagesAsync = async function(sample_file) {
    let relative_sample_file_name = path.relative(cardRootPath, sample_file);

    const songs = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath, 'SONGS'));
    const synths = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath, 'SYNTHS'));
    const kits = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath, 'KITS'));

    const all = songs.concat(synths, kits);
    return all;
}

exports.usagesAsync = usagesAsync
