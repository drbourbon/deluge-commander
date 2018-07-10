const {dialog} = require('electron').remote
const fs = require('fs');
const path = require('path');
var $ = require('jquery');
const settings = require('electron-settings');
//var wavInfo = require('./wav-info');
const wavFileInfo = require('wav-file-info');
const moment = require('moment');
const prettyBytes = require('pretty-bytes');

const mover = require('./mover.js');

var momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);

let cardRootPath = settings.get('card_root');
let samplesRootPath = path.join(cardRootPath, 'SAMPLES');

let currentPath = samplesRootPath;

function setRoot() {
    let choosen_root_path = dialog.showOpenDialog(
        {
            title:'Choose Deluge SD card root', 
            properties: ['openDirectory']
        });
    if(!choosen_root_path)return;
    if(mover.validRootPath(choosen_root_path[0])) {
        settings.set('card_root', choosen_root_path[0]);
        cardRootPath = choosen_root_path[0];
        readFolder();
      } else {
        dialog.showErrorBox('error','Invalid Deluge SD card root');
    }
}

function moveSample(sample_path){
    let destination_path = dialog.showOpenDialog(
        {
            title:'Choose destination folder', 
            defaultPath: path.join(cardRootPath, 'SAMPLES'),
            properties: ['openDirectory']
        });

}

function setCurrentPath(cpath) {
    currentPath = cpath;

    let apath;
    if(cpath!==samplesRootPath){
        apath = path.relative(samplesRootPath, cpath).split(path.sep);
    } else {
        apath = [];
    }
    apath.unshift('SAMPLES');

    // render breadcrumb
    $('#pwd').html('<ol id="pwd-list" class="breadcrumb"></ol>');

    $('#pwd-list').append('<li class="breadcrumb-item"><button class="btn btn-link" onclick="setRoot()"><i class="fa fa-hdd-o" aria-hidden="true"></i></button></li>');

    let fullPath = '';
    var i;
    for(i=0; i<apath.length;i++){
        let el = apath[i];
        if(i>0) fullPath += path.sep + el;
        let clicklink = i==0 ? samplesRootPath : path.join(samplesRootPath, fullPath);
        $('#pwd-list').append(`<li class="breadcrumb-item"><button class="btn btn-link" onclick="readFolder('${clicklink}')">${el}</button></li>`);
    }


    /*
    apath.forEach(function(el){
        $('#pwd-list').append(`<li class="breadcrumb-item" onclick="readFolder()">${el}</li>`);
    })
    */
}

//const file_bootstrap_class = 'list-group-item d-flex justify-content-between align-items-center';
const file_bootstrap_class = 'list-group-item list-group-item-action';
const id_regexp = new RegExp(path.sep,'g');

function renderFile(name, fpath, renderMode, isDirectory) {
    switch(renderMode){
        case 'list':
            if(isDirectory){
                return `<a href="#" data-path="${fpath}" class="${file_bootstrap_class}" onclick="readFolder(this.dataset.path)"><h5><i class="fa fa-folder-open"></i> ${name}</h5></a>`
            } else {
                return $(`<div data-path="${fpath}" class="${file_bootstrap_class}"><h5><i class="fa fa-file-audio-o"></i> ${name} <span class="counter badge badge-primary badge-pill"></span></h5> <span class="actions text-right float-right"></span></div>`)
            }
        case 'card':
            if(isDirectory){
                return `<div data-path="${fpath}" class="card col-4 col-lg-3 col-sm-6 m-2"><div class="card-body"><h5 class="card-title">${name}</h5></div></div>`;
            } else {
                return `<div data-path="${fpath}" class="card col-4 col-lg-3 col-sm-6 m-2"><div class="card-body"><h5 class="card-title">${name}</h5></div></div>`;
            }
    }
}

function readFolder(cpath = samplesRootPath, renderMode = 'list') {
    setCurrentPath(cpath);
    fs.readdir(cpath, (err, files) => {
        'use strict';
        if (err) throw  err;

        let rootElement = $('#sample-browser');
        if(renderMode==='list'){
            rootElement.html('<div id="sample-files" class="list-group"></div>');
        } else {
            rootElement.html('<div id="sample-files" class="row"></div>');
        }

        for (let file of files) {
            if(file.startsWith('.')) continue;
            let fpath = path.join(cpath, file);
            fs.stat(fpath, (err,stats)=>{
                if(err) throw err;
                let item;
                const relative_path = path.relative(samplesRootPath, fpath);
                if(stats.isDirectory()){
                    item = renderFile(file,fpath,renderMode,true);// `<a href="#" data-path="${fpath}" class="${file_bootstrap_class}" onclick="readFolder(this.dataset.path)"><i class="fa fa-folder-open"></i> ${file}</a>`;
                } else {
                    item = renderFile(file,relative_path,renderMode,false);//$(`<a href="#" data-path="${relative_path}" class="${file_bootstrap_class}"><i class="fa fa-file"></i> ${file}</a>`);
                }
                
                $('#sample-files').append(item);

                if(!stats.isDirectory()){
                    mover.usagesAsync(fpath).then((usages)=>{
                        let actions = item.find('.actions');// $(`<div class="text-right"></div>`);
                        
                        if(usages.length>0){
                            //console.log(`Found ${usages.length} for ${idpath}`);
                            item.find('.counter').append(usages.length);
//                            item.append(` <span class="badge badge-primary badge-pill">${usages.length}</span>`);

                            let usages_rendered = usages.map(((x)=>{ 
                                let badge_type = x.startsWith('KITS') ? 'badge-success' : (x.startsWith('SONGS') ? 'badge-primary' : 'badge-info');
                                return `<span class="badge ${badge_type}">${x}</span>`;
                            })).join(" ");

                            // item.append(`<div>${usages.map(((x)=>{ return '<span class="badge badge-secondary">' + x + '</span>'})).join(" ")}</div>`);
                            item.append(`<div>${usages_rendered}</div>`);
                        } else {
                            actions.append(' <button class="btn btn-outline-danger btn-sm ml-2"><i class="fa fa-trash"></i></button>')
                        }

                        actions.append(`<button onclick="moveSample('${relative_path}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-folder-o" aria-hidden="true"></i></button>`)
                        //item.append(actions);
                    });

                    wavFileInfo.infoByFilename(fpath, (err,info) => {
                        if (err && err.invalid_reasons[0].startsWith('chunk_size')) return;
                        if (err) throw err;

                        let rinfo = $(`<div><small class='wav-info'></small></div>`);

                        [
                            ['rate', info.header.sample_rate, 'Hz'],
                            ['duration', moment.duration(Math.round(info.duration * 1000)).format(), ''],
                            ['bits', info.header.bits_per_sample, ''],
                            ['channels', info.header.num_channels == 1 ? 'mono': (info.header.num_channels==2 ? 'stereo' : 'multi'), ''],
                            ['size', prettyBytes(info.stats.size), '']
                        ].forEach((el)=>{
                            rinfo.find('.wav-info').append(`${el[0]}: <strong>${el[1]}${el[2]}</strong> `);
                        });
                        item.append(rinfo);
                        //console.log(info);
                    })
                }
            })
        }
    });
}

