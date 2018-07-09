const fs = require('fs');
const path = require('path');
const parser = require('fast-xml-parser');
const settings = require('electron-settings');

let cardRootPath = settings.get('card_root');

var scan_dir = function(sample_file_name, scan_path) {
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


exports.usages = function(sample_file) {
    let relative_sample_file_name = path.relative(cardRootPath, sample_file);
//    console.log('finding usages for: ' + relative_sample_file_name);
    let occurences = [];
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath, 'SONGS')));
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath, 'SYNTHS')));
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath, 'KITS')));
    console.log(JSON.stringify(occurences));
};