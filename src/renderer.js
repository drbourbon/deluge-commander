const {dialog} = require('electron').remote;
const remote = require('electron').remote;

const fs = require('fs');
const path = require('path');
const $ = require('jquery');
const settings = require('electron-settings');
//var wavInfo = require('./wav-info');
const wavFileInfo = require('wav-file-info');
const moment = require('moment');
const prettyBytes = require('pretty-bytes');
const prompt = require('electron-prompt');
const fileUrl = require('file-url');
const slash = require('slash');

const webAudioBuilder = require('waveform-data/webaudio');

const mover = require('./mover.js');

const audioContext = new AudioContext();

var momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);

let cardRootPath = mover.cardRootPath; //settings.get('card_root');
const disable_waveforms = settings.get('disable_waveforms');
let samplesRootPath = path.join(cardRootPath(), 'SAMPLES');

let currentPath = samplesRootPath;

function setRoot() {
    let choosen_root_path = dialog.showOpenDialog(
        {
            title:'Choose Deluge SD card root', 
            properties: ['openDirectory']
        });
    if(!choosen_root_path)return;
    if(mover.validRootPath(choosen_root_path[0])) {
        console.log(choosen_root_path[0]);
        settings.set('card_root', choosen_root_path[0]);
//        cardRootPath = choosen_root_path[0];
        samplesRootPath = path.join(cardRootPath(), 'SAMPLES');
        mover.sync_from_card();
        readFolder();
      } else {
        dialog.showErrorBox('error','Invalid Deluge SD card root');
        return;
    }
}

let currently_playing = null;

function newFolder() {
    prompt({
        title: 'Add folder',
        label: 'new folder name',
        value: name,
        inputAttrs: {
            type: 'text'
        }
    }, remote.getCurrentWindow()).then(r => {
        if (!r) return;
        try {
            const new_folder_absolute_path = path.join(currentPath,r);
            console.log(`Creating folder ${new_folder_absolute_path}`);
            fs.mkdirSync(new_folder_absolute_path);
            readFolder(currentPath);
        } catch (error) {
            dialog.showErrorBox('error creating folder',error.message);
        }
    });
}

function stopPlay() {
//    if(currently_playing) currently_playing.unload();
    const player = $('#player');
    if(player[0])player[0].pause();
}

function playSample(sample_path){
    const absolute_sample_path = path.join(cardRootPath(),sample_path);
    console.log('Playing ' + fileUrl(absolute_sample_path));

    const player = $('#player');
    player.attr('src', fileUrl(absolute_sample_path));
//    player.attr('src', 'https://freewavesamples.com/files/Yamaha-V50-Synbass-1-C2.wav');
    player[0].load();
    player[0].play();
}

/*
function playSample(sample_path) {
    const absolute_sample_path = path.join(cardRootPath(),sample_path);
    console.log('Playing ' + absolute_sample_path);
    if(currently_playing) currently_playing.unload();
    currently_playing = new Howl({ 
        src: [absolute_sample_path],
        autoplay: true,
        html5:true,
        format: ['wav']
    });
//    Howler.unload();
    //currently_playing.play();
}
*/

function deleteSample(sample_path) {
    const absolute_sample_path = path.join(cardRootPath(), sample_path);
    const usages = mover.usages(absolute_sample_path);

    if(usages.length>0){
        dialog.showErrorBox(`Can't delete because sample ${sample_path} is used by ${usages.join(', ')}`);
        return;
    }

    let confirmation = dialog.showMessageBox({
        type: 'question',
        message: `Deleting ${sample_path}. Proceed?`,
        buttons: ['Cancel','OK']
    });

    if(confirmation && confirmation===1){
        try {
            mover.delete(absolute_sample_path);
            readFolder(currentPath);
        } catch (error) {
            dialog.showErrorBox('error deleting sample',error.message);
        }
    }
}

function renameFolder(sample_folder) {
    const name = path.basename(sample_folder);
    prompt({
        title: 'Rename folder',
        label: 'new folder name',
        value: name,
        inputAttrs: {
            type: 'text'
        }
    }, remote.getCurrentWindow()).then(r => {
        if (!r) return;
        if(r===name)return;

        const new_name = r.replace(/[\u0000-\u0008,\u000B,\u000C,\u000E-\u001F,\u0022,\u0026,\u0027,\u003C,\u003E]/g, '');
        const absolute_sample_folder = path.join(cardRootPath(), sample_folder, '/');
        const relative_destination_path = path.join(path.dirname(sample_folder),new_name,'/');
        const absolute_destination_path = path.join(cardRootPath(),relative_destination_path);

        // re-scan just in case (safer!!)
        let usages = mover.usages(absolute_sample_folder);
        let message = `Renaming ${sample_folder} to ${relative_destination_path}. Proceed?`;
        let dmessage = usages.length>0 ? `The following files will also be updated: ${usages.join(', ')}.` : '';

        let confirmation = dialog.showMessageBox({
            type: 'question',
            message: message,
            detail: dmessage,
            buttons: ['Cancel','OK']
        });

        if(confirmation && confirmation===1){
            try {
                mover.move_folder(absolute_sample_folder, absolute_destination_path, usages, true);
                readFolder(currentPath);
            } catch (error) {
                dialog.showErrorBox('error renaming folder',error.message);
            }
        }

    })
}

function moveFolder(sample_folder){
    const destination_paths = dialog.showOpenDialog(
        {
            title:'Choose destination folder', 
            defaultPath: path.join(cardRootPath(), 'SAMPLES'),
            properties: ['openDirectory']
        });
    if(!destination_paths) return;

    let destination_path = destination_paths[0];
    if(!mover.validSampleDestinationPath(destination_path)){
        dialog.showErrorBox('error','Invalid destination path. Sample files must be located inside SAMPLES folder');
        return;
    }

    let relative_destination_path = path.relative(cardRootPath(), destination_path);
    let absolute_sample_folder_path = path.join(cardRootPath(), sample_folder);

    // re-scan just in case (safer!!)
    let usages = mover.usages(absolute_sample_folder_path);
    let message = `Moving ${sample_folder} to ${relative_destination_path}. Proceed?`;
    let dmessage = usages.length>0 ? `The following ${usages.length} files will also be updated: ${usages.join(', ')}.` : '';

    let confirmation = dialog.showMessageBox({
        type: 'question',
        message: message,
        detail: dmessage,
        buttons: ['Cancel','OK']
    });

    if(confirmation && confirmation===1){
        try {
            mover.move_folder(absolute_sample_folder_path, destination_path, usages, false);
            readFolder(currentPath);
        } catch (error) {
            dialog.showErrorBox('error moving sample folder',error.message);
        }
    }
}

function renameSample(sample_path) {
    const name = path.basename(sample_path, path.extname(sample_path));

    prompt({
        title: 'Rename sample',
        label: 'new file name',
        value: name,
        inputAttrs: {
            type: 'text'
        }
    }, remote.getCurrentWindow()).then(r => {
        if (!r) return;
        if(r===name)return;

        const new_name = r.replace(/[\u0000-\u0008,\u000B,\u000C,\u000E-\u001F,\u0022,\u0026,\u0027,\u003C,\u003E]/g, '');
        const absolute_sample_path = path.join(cardRootPath(), sample_path);
        const relative_destination_path = path.join(path.dirname(sample_path),new_name + '.WAV');
        const absolute_destination_path = path.join(cardRootPath(),relative_destination_path);

        // re-scan just in case (safer!!)
        let usages = mover.usages(absolute_sample_path);
        let message = `Renaming ${sample_path} to ${relative_destination_path}. Proceed?`;
        let dmessage = usages.length>0 ? `The following files will also be updated: ${usages.join(', ')}.` : '';

        let confirmation = dialog.showMessageBox({
            type: 'question',
            message: message,
            detail: dmessage,
            buttons: ['Cancel','OK']
        });

        if(confirmation && confirmation===1){
            try {
                mover.move(absolute_sample_path, absolute_destination_path, usages);
                readFolder(currentPath);
            } catch (error) {
                dialog.showErrorBox('error renaming sample',error.message);
            }
        }

    })
}

function moveSample(sample_path){
    const destination_paths = dialog.showOpenDialog(
        {
            title:'Choose destination folder', 
            defaultPath: path.join(cardRootPath(), 'SAMPLES'),
            properties: ['openDirectory']
        });
    if(!destination_paths) return;

    let destination_path = destination_paths[0];
    if(!mover.validSampleDestinationPath(destination_path)){
        dialog.showErrorBox('error','Invalid destination path. Sample files must be located inside SAMPLES folder');
        return;
    }

    let relative_destination_path = path.relative(cardRootPath(), destination_path);
    let absolute_sample_path = path.join(cardRootPath(), sample_path);

    // re-scan just in case (safer!!)
    let usages = mover.usages(absolute_sample_path);
    let message = `Moving ${sample_path} to ${relative_destination_path}. Proceed?`;
    let dmessage = usages.length>0 ? `The following ${usages.length} files will also be updated: ${usages.join(', ')}.` : '';

    let confirmation = dialog.showMessageBox({
        type: 'question',
        message: message,
        detail: dmessage,
        buttons: ['Cancel','OK']
    });

    if(confirmation && confirmation===1){
        try {
            mover.move(absolute_sample_path, destination_path, usages);
            readFolder(currentPath);
        } catch (error) {
            dialog.showErrorBox('error moving sample',error.message);
        }
    }
}

function setCurrentPath(cpath) {
    currentPath = cpath;

    // TODO stop playing sample if any (too lazy to add other controls for that)
    stopPlay();

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
        let clicklink = slash(i==0 ? samplesRootPath : path.join(samplesRootPath, fullPath));
        $('#pwd-list').append(`<li class="breadcrumb-item"><button class="btn btn-link" onclick="readFolder('${clicklink}')">${el}</button></li>`);
    }


    /*
    apath.forEach(function(el){
        $('#pwd-list').append(`<li class="breadcrumb-item" onclick="readFolder()">${el}</li>`);
    })
    */

//    mover.sync_from_card();
}


// 'C:\Users\drb\Documents\deluge-commander\UsersdrbDesktopBACKUP DELUGE 2SAMPLES
//const file_bootstrap_class = 'list-group-item d-flex justify-content-between align-items-center';
const file_bootstrap_class = 'list-group-item list-group-item-action';
//const id_regexp = new RegExp(path.sep,'g');

function renderFile(name, fpath, renderMode, isDirectory) {
    if(isDirectory){
//        return $(`<a href="#" data-path="${fpath}" class="deluge-folder ${file_bootstrap_class}" onclick="readFolder(this.dataset.path)"><h5><i class="fa fa-folder-open"></i> ${name}</h5> <span class="actions text-right float-right"></span></div></a>`);
        return $(`<div data-path="${fpath}" class="deluge-folder ${file_bootstrap_class}"><h5><i class="fa fa-folder-open"></i> ${name}</h5> <span class="actions text-right float-right"></span></div>`)
    } else {
        return $(`<div data-path="${fpath}" class="deluge-sample ${file_bootstrap_class} loading-sample"><h5><i class="fa fa-file-audio-o"></i> ${name} <span class="counter badge badge-primary badge-pill"></span></h5> <span class="actions text-right float-right"></span></div>`)
    }
}

function toggleMulti() {
    $('.deluge-sample').checkable();
}

$.fn.extend({
    checkable: function() {
      return this.each(function() {
        $(this).addClass('checkable');
        $(this).click(()=>{
            if($(this).hasClass('checked')){
                $(this).removeClass('checked');
            } else {
                $(this).addClass('checked');
            }
        })
      });
    },
    uncheckable: function() {
      return this.each(function() {
          $(this).removeClass('.checkable');
          $(this).off();
      });
    }
  });

function readFolder(cpath = samplesRootPath, renderMode = 'list') {
//    mover.sync_from_card();
    setCurrentPath(cpath);

    fs.readdir(cpath, (err, files) => {
        'use strict';
        if (err) throw  err;

        let rootElement = $('#sample-browser');
        if(renderMode==='list'){
            rootElement.html('<div id="sample-files" class="list-group w-100"></div>');
        } else {
            rootElement.html('<div id="sample-files" class="row"></div>');
        }

        for (let file of files) {
            if(file.startsWith('.')) continue;

            let fpath = slash(path.join(cpath, file));
            fs.stat(fpath, (err,stats)=>{
                if(err) throw err;

                if(!stats.isDirectory() && path.extname(file).toLowerCase()!=='.wav') return;

                let item;
                const relative_path = slash(path.relative(cardRootPath(), fpath));
                if(stats.isDirectory()){
                    item = renderFile(file,fpath,renderMode,true);
                } else {
                    item = renderFile(file,relative_path,renderMode,false);
                    let actions = item.find('.actions');
                    actions.append(`<button onclick="playSample('${relative_path}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-play-circle-o fa-lg" aria-hidden="true"></i></button>`)
                }
                
                $('#sample-files').append(item);

                if(!stats.isDirectory()){
                    const my_item = item;

                    mover.usagesAsync(fpath).then((usages)=>{
                        let actions = my_item.find('.actions');
                        
                        //console.log(`Done analyzing ${relative_path}`);
                        my_item.removeClass("loading-sample");

                        if(usages.length>0){
                            //console.log(`Found ${usages.length} for ${idpath}`);
                            my_item.find('.counter').append(usages.length);

                            let usages_rendered = usages.map(((x)=>{ 
                                let badge_type = x.startsWith('KITS') ? 'badge-success' : (x.startsWith('SONGS') ? 'badge-primary' : 'badge-info');
                                return `<span class="badge ${badge_type}">${x}</span>`;
                            })).join(" ");

                            // item.append(`<div>${usages.map(((x)=>{ return '<span class="badge badge-secondary">' + x + '</span>'})).join(" ")}</div>`);
                            my_item.append(`<div>${usages_rendered}</div>`);
                        } else {
                            actions.append(`<button onclick="deleteSample('${relative_path}')" class="btn btn-outline-danger btn-sm ml-2"><i class="fa fa-trash"></i></button>`);
                        }

                        actions.append(`<button onclick="renameSample('${relative_path}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-pencil-square-o fa-lg" aria-hidden="true"></i></button>`)
                        actions.append(`<button onclick="moveSample('${relative_path}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-arrows-alt fa-lg" aria-hidden="true"></i></button>`)

                        /*
                        my_item.click(()=>{
                            console.log('click');
                            $(this).addClass('active');
                        });
                        */

                        if(!disable_waveforms || disable_waveforms===false){

                            fetch(fileUrl(fpath))
                            .then(response => response.arrayBuffer())
                            .then(buffer => {
                                webAudioBuilder(audioContext, buffer, (err, waveform) => {
                                if (err) {
                                    console.error(err);
                                    return;
                                }
     
                                let canvas = $('#waveform-placeholder')[0];
                                canvas.width = my_item.width();
     
                                const interpolateHeight = (total_height) => {
                                    const amplitude = 256;
                                    return (size) => total_height - ((size + 128) * total_height) / amplitude;
                                };
                                
                                const y = interpolateHeight(canvas.height);
                                const ctx = canvas.getContext('2d');
     
                                //console.log(ctx);
                                ctx.clearRect(0, 0, canvas.width, canvas.height);
                                ctx.beginPath();
                                
                                // from 0 to 100
                                waveform.min.forEach((val, x) => ctx.lineTo(x + 0.5, y(val) + 0.5));
                                
                                // then looping back from 100 to 0
                                waveform.max.reverse().forEach((val, x) => {
                                ctx.lineTo((waveform.offset_length - x) + 0.5, y(val) + 0.5);
                                });
                                
                                ctx.closePath();
                                ctx.fillStyle = 'lightGrey';
                                ctx.lineWidth = 1;
                                ctx.strokeStyle= 'lightGrey';
                                ctx.fill();
                                ctx.stroke();
     
                                const pngUrl = canvas.toDataURL(); 
                                my_item.css({
                                     'background-size': '100% 100%',
                                     'background-image': "url(" + pngUrl + ")",
                                     'background-position': 'center left'
     
                                })
     
                                //console.log(pngUrl);
                                });
                            });
     

                        }

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
                        my_item.append(rinfo);
                        //console.log(info);
                    })



                } else {
                    // sample directory actions
                    let actions = item.find('.actions');
                    actions.append(`<button onclick="readFolder('${fpath}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-folder-open-o fa-lg" aria-hidden="true"></i></button>`);
                    if(file!=='RESAMPLE' && file!=='RECORD'){
                        actions.append(`<button onclick="renameFolder('${relative_path}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-pencil-square-o fa-lg" aria-hidden="true"></i></button>`)
                        actions.append(`<button onclick="moveFolder('${relative_path}')" class="btn btn-outline-primary btn-sm ml-2"><i class="fa fa-arrows-alt fa-lg" aria-hidden="true"></i></button>`)
                    }
                }
            })
        }
    });
}
