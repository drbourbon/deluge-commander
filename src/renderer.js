const fs = require('fs');
const path = require('path');
var $ = require('jquery');
const settings = require('electron-settings');
let cardRootPath = settings.get('card_root');

let samplesRootPath = path.join(cardRootPath, 'SAMPLES');

fs.readdir(samplesRootPath, (err, files) => {
    'use strict';
    //if an error is thrown when reading the directory, we throw it. Otherwise we continue
    if (err) throw  err;
    //the files parameter is an array of the files and folders in the path we passed. So we loop through the array, printing each file and folder
    for (let file of files) {
        if(file.startsWith('.')) continue;
        let fpath = path.join(samplesRootPath, file);
        fs.stat(fpath, (err,stats)=>{
            if(err) throw err;
            let item;
            if(stats.isDirectory()){
                item = `<li><i class="fa fa-folder-open"></i> ${file}</li>`;
            } else {
                item = `<li><i class="fa fa-file"></i> ${file}</li>`;
            }
            $('#sample-files').append(item);
        })
    }
});