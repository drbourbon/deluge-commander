const fs = require('fs');
const path = require('path');
var $ = require('jquery');
const settings = require('electron-settings');
const mover = require('./mover.js');

let cardRootPath = settings.get('card_root');
let samplesRootPath = path.join(cardRootPath, 'SAMPLES');

let currentPath = samplesRootPath;

function setCurrentPath(cpath) {
    currentPath = cpath;
    console.log(currentPath);

    let apath;
    if(cpath!==samplesRootPath){
        apath = path.relative(samplesRootPath, cpath).split(path.sep);
    } else {
        apath = [];
    }
    apath.unshift('Samples Home');

    // render breadcrumb
    $('#pwd').html('<ol id="pwd-list" class="breadcrumb"></ol>');

    apath.forEach(function(el){
        $('#pwd-list').append(`<li class="breadcrumb-item" onclick="readFolder()">${el}</li>`);
    })
}

//const file_bootstrap_class = 'list-group-item d-flex justify-content-between align-items-center';
const file_bootstrap_class = 'list-group-item';

function readFolder(cpath = samplesRootPath) {
    setCurrentPath(cpath);
    fs.readdir(cpath, (err, files) => {
        'use strict';
        if (err) throw  err;

        let rootElement = $('#sample-browser');
        rootElement.html('<ul id="sample-files" class="list-group"></ul>');

        for (let file of files) {
            if(file.startsWith('.')) continue;
            let fpath = path.join(cpath, file);
            fs.stat(fpath, (err,stats)=>{
                if(err) throw err;
                let item;
                if(stats.isDirectory()){
                    item = `<li id="${fpath}" class="${file_bootstrap_class}" onclick="readFolder(this.id)"><i class="fa fa-folder-open"></i> ${file}</li>`;
                } else {
                    // TODO use path.sep in regex
                    let idpath = path.relative(samplesRootPath, fpath).replace(/\//g,'');
                    let usages = mover.usages(fpath);
                    if(usages.length>0){
                        console.log(`Found ${usages.length} for ${idpath}`);
                        item = `<li id="${idpath}" class="${file_bootstrap_class}"><i class="fa fa-file"></i> ${file} <span class="badge badge-primary badge-pill">${usages.length}</span></li>`;
                    } else {
                        item = `<li id="${idpath}" class="${file_bootstrap_class}"><i class="fa fa-file"></i> ${file}</li>`;
                    }
                }
                $('#sample-files').append(item);
            })
        }
    });
}

