const fs = require('fs');
const path = require('path');
const util = require('util');
//const parser = require('fast-xml-parser');
var pathIsInside = require("path-is-inside");
const settings = require('electron-settings');
const slash = require('slash');

import {Volume, createFsFromVolume} from 'memfs';

//let cardRootPath = settings.get('card_root');

const cardRootPath = function() {
    return settings.get('card_root');
}

exports.cardRootPath = cardRootPath;

let vol = Volume.fromJSON({'/SONGS':0, '/KITS':0, '/SYNTHS':0 });
let mfs = createFsFromVolume(vol);

const mem_load_path = function(what) {
    let songs_path = path.join(cardRootPath(), what);
    let songs_vpath = path.join('/', what);

    let songs = fs.readdirSync(songs_path);
    songs.forEach(file => {
        let file_path = path.join(songs_path, file);
        let dest_path = path.join(songs_vpath, file);
        try {
            let content = fs.readFileSync(file_path);
            vol.writeFileSync(dest_path,content);
            //console.log(`copied ${file_path} to ${dest_path}`);
    } catch (error) {
            throw error;
        }
    });

}

const load_card = function(reset = true) {
    if(reset){
        vol.reset();
        vol.mkdirpSync(path.join('/','SONGS'));
        vol.mkdirpSync(path.join('/','KITS'));
        vol.mkdirpSync(path.join('/','SYNTHS'));
        /*
        vol = Volume.fromJSON({'/SONGS':0, '/KITS':0, '/SYNTHS':0 });
        mfs = createFsFromVolume(vol);
        */
    }

    mem_load_path('SONGS');
    mem_load_path('KITS');
    mem_load_path('SYNTHS');

    /*
    readdirP(path.join('/', 'SONGS'), (err, files)=>{
        console.log(files);
    });
    */
}
exports.sync_from_card = load_card;

const rewrite_wav_ref = function(xml_file, source_relative, destination_relative) {
    const slashed_source_relative = slash(source_relative);
    const slashed_destination_relative = slash(destination_relative);
    console.log(`${xml_file}: rewriting references to ${slashed_source_relative} to ${slashed_destination_relative}`);

    // TODO double check the encoding
    let data = fs.readFileSync(xml_file, { encoding: "ascii" });
    let regex = new RegExp(`<fileName>${slashed_source_relative}<\/fileName>`,'g');

    // [FB] this is the important stuff!!
    let new_data = data.replace(regex, '<fileName>' + slashed_destination_relative + '<\/fileName>');
//    let new_data = data.replace(/<fileName>[\s\S]*?<\/fileName>/, '<fileName>' + slashed_destination_relative + '<\/fileName>');

    let temp_name = xml_file + '.new';
    fs.writeFileSync(temp_name,new_data,"ascii"); 
}

const rewrite_folder_ref = function(xml_file, source_relative, destination_relative) {
    const slashed_source_relative = slash(source_relative);
    const slashed_destination_relative = slash(destination_relative);
    console.log(`${xml_file}: rewriting references to ${slashed_source_relative} to ${slashed_destination_relative}`);

    // TODO double check the encoding
    let data = fs.readFileSync(xml_file, { encoding: "ascii" });
    let regex = new RegExp(`<fileName>${slashed_source_relative}`,'g');

    // [FB] this is the important stuff!!
    let new_data = data.replace(regex, '<fileName>' + slashed_destination_relative);

    let temp_name = xml_file + '.new';
    fs.writeFileSync(temp_name,new_data,"ascii"); 
}

exports.delete = function(sample_path) {
    if(!fs.existsSync(sample_path)){
        throw new Error(`Sample ${sample_path} not found`);
    }
    try {
        fs.unlinkSync(sample_path);
    } catch (error) {
        throw error;
    }
}

exports.move_folder = function(source, dest, usages, is_renaming = false) {
    if(is_renaming && fs.existsSync(dest)){
        throw new Error('Destination exists');
    }
    const source_pathname = path.basename(source);
    const source_relative = path.join(path.relative(cardRootPath(), source),'/');
    const destination_relative = 
        is_renaming 
            ? path.join(path.relative(cardRootPath(), dest),'/')
            : path.join(path.relative(cardRootPath(), dest), source_pathname,'/');
//    throw new Error(source_relative + '->' + destination_relative);
//throw new Error(source + '->' + path.join(dest,source_pathname));

    try {
        usages.forEach(f => {
            const fpath = path.join(cardRootPath(),f);
            rewrite_folder_ref(fpath,source_relative,destination_relative);
        });

        if(is_renaming){
            fs.renameSync(source, dest); // atomic? 

        } else {
            fs.renameSync(source, path.join(dest,source_pathname)); // atomic? 
        }

        usages.forEach(f => {
            const fpath = path.join(cardRootPath(),f);
            const temp_name = fpath + '.new';
            fs.renameSync(temp_name, fpath);
        })

    } catch (error) {
        throw error;
    } finally {
        usages.forEach(f => {
            const fpath = path.join(cardRootPath(),f);
            const temp_name = fpath + '.new';
            if(fs.existsSync(temp_name)){
                fs.unlinkSync(temp_name);
            }
        });
        mover.sync_from_card();
    }
}

exports.move = function(source, dest_path, usages) {
    const is_renaming = path.extname(dest_path).endsWith('WAV');

    const source_relative = path.relative(cardRootPath(), source);
    const source_filename = path.basename(source);
    
    const destination_path_relative = path.relative(cardRootPath(), dest_path);
    const destination_relative = is_renaming ? destination_path_relative : path.join(destination_path_relative, source_filename);
    const destination_absolute = is_renaming ? dest_path : path.join(dest_path, source_filename);

    if(fs.existsSync(destination_absolute)){
        throw new Error('Destination exists');
    }

    // [FB] critical (reversible) block
    try {
        usages.forEach(f => {
            const fpath = path.join(cardRootPath(),f);
            rewrite_wav_ref(fpath,source_relative,destination_relative);
        });
//        throw new Error("mi sono rotto!!");

        fs.renameSync(source, destination_absolute); // atomic? 

        usages.forEach(f => {
            const fpath = path.join(cardRootPath(),f);
            const temp_name = fpath + '.new';
            fs.renameSync(temp_name, fpath);
        })

    } catch (error) {
        throw error;
    } finally {
        usages.forEach(f => {
            const fpath = path.join(cardRootPath(),f);
            const temp_name = fpath + '.new';
            if(fs.existsSync(temp_name)){
                fs.unlinkSync(temp_name);
            }
        });
        mover.sync_from_card();
    }

}

exports.validRootPath = function(dpath) {
    const isValid = fs.existsSync(dpath) 
        && fs.existsSync(path.join(dpath, 'SAMPLES'))
        && fs.existsSync(path.join(dpath, 'KITS'))
        && fs.existsSync(path.join(dpath, 'SONGS'))
        && fs.existsSync(path.join(dpath, 'SYNTHS'));
    return isValid;
}

exports.validSampleDestinationPath = function(dpath) {
    let sample_root = path.join(cardRootPath(), 'SAMPLES');
//    console.log('checking ' + dpath + ' against ' + sample_root);
    return pathIsInside(dpath, sample_root);
}

// [FB] syncronous functions used to double check actual files before doing potentially destructive operations

const scan_dir = function(sample_file_name, scan_path) {
//    console.log('Finding usages for ' + sample_file_name + ' in ' + scan_path);
    let found = [];
    let files = fs.readdirSync(scan_path);
    files.forEach(file => {
        let file_path = path.join(scan_path, file);
        if(path.extname(file_path).toUpperCase()!=='.XML') return;
        let data = fs.readFileSync(file_path);
        if(data.indexOf(sample_file_name)>-1){
            let relative_name = path.relative(cardRootPath(), file_path);
//            console.log(sample_file_name + ' used in ' + relative_name);
            found.push(relative_name);
        }

    });
    return found;
};

const usages = function(sample_file) {
    let relative_sample_file_name = slash(path.relative(cardRootPath(), sample_file));
//    console.log('finding usages for: ' + relative_sample_file_name);
    let occurences = [];
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath(), 'SONGS')));
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath(), 'SYNTHS')));
    occurences = occurences.concat(scan_dir(relative_sample_file_name, path.join(cardRootPath(), 'KITS')));
//    console.log(JSON.stringify(occurences));
    return occurences;
};

exports.usages = usages;


// ------ ASYNC VERSIONS

const readfileP = util.promisify(mfs.readFile);
const readdirP = util.promisify(mfs.readdir);

/*
const readfileP = util.promisify(fs.readFile);
const readdirP = util.promisify(fs.readdir);
*/

const sample_occurs_in_file = async function(sample_file_name, file_path) {
    const data = await readfileP(file_path);
    if(data.indexOf(sample_file_name)>-1){
//        let relative_name = path.relative(cardRootPath(), file_path);
        return true;
    }
    return false;
}

const scan_dir_async = async function(sample_file_name, scan_path) {
//        console.log('Finding usages for ' + sample_file_name + ' in ' + scan_path);
    let found = [];
    const files = await readdirP(scan_path);
    for (let file of files) {
        let file_path = path.join(scan_path, file);
        //console.log(file_path + ' has ' + sample_file_name + ' ..');
        if(path.extname(file_path).toUpperCase()!=='.XML') continue;
        const occurs = await sample_occurs_in_file(sample_file_name, file_path);
        if(occurs) {
            let relative_name = path.relative('/', file_path);
            //let relative_name = path.relative(cardRootPath(), file_path);
            //console.log(sample_file_name + ' used in ' + relative_name);
            found.push(relative_name);
        }
    }
    return found;
};

// [FB] sample_file is either a .wav file or a sample directory
const usagesAsync = async function(sample_file) {
//    let is_dir = fs.lstatSync(sample_file).isDirectory();
    let relative_sample_file_name = slash(path.relative(cardRootPath(), sample_file));

    const songs = await scan_dir_async(relative_sample_file_name, path.join('/','SONGS'));
    const synths = await scan_dir_async(relative_sample_file_name, path.join('/','SYNTHS'));
    const kits = await scan_dir_async(relative_sample_file_name, path.join('/','KITS'));

    /*
    const songs = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath(), 'SONGS'));
    const synths = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath(), 'SYNTHS'));
    const kits = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath(), 'KITS'));
    */

    const all = songs.concat(synths, kits);
    return all;

}

exports.usagesAsync = usagesAsync;
