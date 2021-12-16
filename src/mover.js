const fs = require('fs');
const path = require('path');
const util = require('util');
//const parser = require('fast-xml-parser');
var pathIsInside = require("path-is-inside");
const settings = require('electron-settings');
//const { prefEnabled } = require('./preferences');
const slash = require('slash');
const trash = require('trash');
const matchAll = require("match-all");
const JSZip = require("jszip");

import {Volume, createFsFromVolume} from 'memfs';

//let cardRootPath = settings.get('card_root');

const cardRootPath = function() {
    return settings.get('card_root');
}

exports.cardRootPath = cardRootPath;

exports.setSavePath = function(val) {
    settings.set('save_path',val);
}

exports.getSavePath = function() {
    return settings.get('save_path', require('os').homedir());
}

exports.getSyncOps = function() {
    return true;// settings.get('sync_operations');
}

let vol = Volume.fromJSON({'/SONGS':0, '/KITS':0, '/SYNTHS':0 });
let mfs = createFsFromVolume(vol);

const _getAllFiles = (what,dir) =>
  fs.readdirSync(dir).reduce((files, file) => {
    const name = path.join(dir, file);
    const to_add = what==dir ? file : path.join(path.relative(what,dir),file)
    //console.log(`(${what}) ${dir} => ${file} (${to_add})`);
    const isDirectory = fs.statSync(name).isDirectory();
    return isDirectory ? [...files, ..._getAllFiles(what,name)] : [...files, to_add];
  }, []);

const getAllFiles = (dir) => _getAllFiles(dir,dir);

const mem_load_path = function(what) {
    let songs_path = path.join(cardRootPath(), what);
    let songs_vpath = path.join('/', what);

    let songs = getAllFiles(songs_path);
    songs.forEach(file => {
        let file_path = path.join(songs_path, file);
        let dest_path = path.join(songs_vpath, file);
        try {
            let content = fs.readFileSync(file_path);
            vol.mkdir(path.dirname(dest_path), { recursive: true}, function (err) {
                if(err) throw 'Cannot create folder';
                vol.writeFileSync(dest_path,content);
            })
            //console.log(`copied ${file_path} to ${dest_path}`);
    } catch (error) {
            throw error;
        }
    });

}

const is_sample = function(file_path) {
    return path.extname(file_path).toUpperCase().endsWith('WAV')
}

const load_card = function(reset) {
    if(reset==false && mover.getSyncOps()==true) reset = true;

    console.log(`${reset?"full ":""}card cache sync started..`);

    if(reset){
        purge_cache();
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

   console.log('card cache sync completed!');
}
exports.sync_from_card = load_card;

const rewrite_wav_ref = function(xml_file, source_relative, destination_relative) {
    const slashed_source_relative = slash(source_relative);
    const slashed_destination_relative = slash(destination_relative);
    console.log(`${xml_file}: rewriting references to ${slashed_source_relative} to ${slashed_destination_relative}`);

    // TODO double check the encoding
    let data = fs.readFileSync(xml_file, { encoding: "ascii" });

    let regex = new RegExp(`<fileName>${slashed_source_relative}<\/fileName>`,'ig');
    // [FB] this is the important stuff!!
    let new_data = data.replace(regex, '<fileName>' + slashed_destination_relative + '<\/fileName>');

    let regex3 = new RegExp(`filePath="${slashed_source_relative}"`,'ig');
    // [FB] this is the important stuff!!
    new_data = new_data.replace(regex3, 'filePath="' + slashed_destination_relative + '"');

    let regex2 = new RegExp(`fileName="${slashed_source_relative}"`,'ig');
    // [FB] this is the important stuff!!
    new_data = new_data.replace(regex2, 'fileName="' + slashed_destination_relative + '"');

    let temp_name = xml_file + '.new';
    fs.writeFileSync(temp_name,new_data,"ascii"); 
}

const rewrite_folder_ref = function(xml_file, source_relative, destination_relative) {
    const slashed_source_relative = slash(source_relative);
    const slashed_destination_relative = slash(destination_relative);
    console.log(`${xml_file}: rewriting folder references to '${slashed_source_relative}' to '${slashed_destination_relative}'`);

    // TODO double check the encoding
    let data = fs.readFileSync(xml_file, { encoding: "ascii" });

    let regex = new RegExp(`<fileName>${slashed_source_relative}`,'ig');
    // [FB] this is the important stuff!!
    let new_data = data.replace(regex, '<fileName>' + slashed_destination_relative);

    let regex3 = new RegExp(`filePath="${slashed_source_relative}`,'ig');
    // [FB] this is the important stuff!!
    new_data = new_data.replace(regex3, 'filePath="' + slashed_destination_relative);

    let regex2 = new RegExp(`fileName="${slashed_source_relative}`,'ig');
    // [FB] this is the important stuff!!
    new_data = new_data.replace(regex2, 'fileName="' + slashed_destination_relative);

    let temp_name = xml_file + '.new';
    fs.writeFileSync(temp_name,new_data,"ascii"); 
}

let my_trash = function(sample){
    (async () => {
        await trash([sample]);
    })();
}

// works for folders as well
exports.delete = function(sample_path) {
    if(!fs.existsSync(sample_path)){
        throw new Error(`Sample ${sample_path} not found`);
    }
    try {
        my_trash([sample_path])
    } catch (error) {
        throw error;
    } finally {
        load_card();
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
    const is_renaming = is_sample(dest_path);// path.extname(dest_path).toUpperCase().endsWith('WAV');

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

exports.samplesReferencesInFile = function(file_path) {
    let relative_file_name = slash(path.relative(cardRootPath(), file_path));
    const data = fs.readFileSync(file_path,'utf8');
    const regex = /<fileName>(.+?)<\/fileName>|filePath="(.+?)"|fileName="(.+?)"/g;
    let wavs = matchAll(data,regex).toArray();
//    let wavs = data.match(/<fileName>(.+)<\/fileName>/g);
/*
    console.log(file_path);
    console.log(wavs);
    */
    return wavs;
}

exports.saveArtefacts = function(file_paths, wavs, to_path) {
    if (!file_paths) throw new Error('Empty artefact list')

//    const file_path = file_paths[0];
    var zip = new JSZip();
    file_paths.forEach(a => {
        const relative_file_name = slash(path.relative(cardRootPath(), a));
        zip.file(relative_file_name, fs.readFileSync(a));
    })

    console.log(file_paths);

    wavs.forEach(w => {
        const wpath = path.join(cardRootPath(),w);
        zip.file(w, fs.readFileSync(wpath));
    })

    console.log(wavs);

    zip.generateNodeStream({type:'nodebuffer',streamFiles:true}).pipe(fs.createWriteStream(to_path))
    .on('finish', function () {
        console.log(to_path + " written.");
    });    
}


const usages = function(sample_file) {
    let relative_sample_file_name = slash(path.relative(cardRootPath(), sample_file));
    console.log('finding usages for: ' + relative_sample_file_name);
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

//const readdirP = util.promisify(mfs.readdir);

const mreaddirP = util.promisify(mfs.readdir);
const statP = util.promisify(mfs.stat);

async function readdirP(dir, fileList = []) {
  const files = await mreaddirP(dir)
  for (const file of files) {
    const stat = await statP(path.join(dir, file))
    if (stat.isDirectory()) fileList = await readdirP(path.join(dir, file), fileList)
    else {
        let fixed_path = path.join(dir,file).split(path.sep).slice(2).join(path.sep)
        //console.log(`(${dir}) ${file} (${fixed_path})`)
        fileList.push(fixed_path)
    }
  }
  return fileList
}

/*
const readfileP = util.promisify(fs.readFile);
const readdirP = util.promisify(fs.readdir);
*/

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const sample_occurs_in_file = async function(sample_file_name, file_path) {
    const is_file = is_sample(sample_file_name);// path.extname(sample_file_name).toUpperCase().endsWith('WAV');
    const data = await readfileP(file_path, 'utf8');
    const safe_file_name = is_file ? sample_file_name : sample_file_name + '/';
    // [TODO] temp fix for case sensitivity issue
    
    const imatch = new RegExp(escapeRegExp(safe_file_name), 'i');
    if(imatch.test(data)){
        return true;
    }
    return false;
}

const sample_occurs_in_file_sync =  function(sample_file_name, file_path) {
    const is_file = is_sample(sample_file_name);// path.extname(sample_file_name).toUpperCase().endsWith('WAV');
    const data = fs.readFileSync(file_path, 'utf8');
    const safe_file_name = is_file ? sample_file_name : sample_file_name + '/';

    // [TODO] temp fix for case sensitivity issue
    const imatch = new RegExp(escapeRegExp(safe_file_name), 'i');
    if(imatch.test(data)){
        return true;
    }
    return false;
}

// [FB] syncronous functions used to double check actual files before doing potentially destructive operations
const scan_dir = function(sample_file_name, scan_path) {
    //console.log('Finding usages for ' + sample_file_name + ' in ' + scan_path);
    let found = [];
    let files = getAllFiles(scan_path);
    files.forEach(file => {
        let file_path = path.join(scan_path, file);
        if(path.extname(file_path).toUpperCase()!=='.XML') return;
        const occurs = sample_occurs_in_file_sync(sample_file_name, file_path);
        if(occurs){
            let relative_name = path.relative(cardRootPath(), file_path);
//            console.log(sample_file_name + ' used in ' + relative_name);
            found.push(relative_name);
        }

    });
    return found;
};

const scan_dir_async = async function(sample_file_name, scan_path) {
//        console.log('Finding usages for ' + sample_file_name + ' in ' + scan_path);
    let found = [];
    const files = await readdirP(scan_path);

    for (let file of files) {
        let file_path = path.join(scan_path, file);
        if(path.extname(file_path).toUpperCase()!=='.XML') continue;
        //console.log('Testing ' + file_path + ' for referring ' + sample_file_name + ' ..');
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

let usage_cache = [];

let purge_cache = function() {
    usage_cache = [];
}

let add_cache = function(el) {
    usage_cache.push(el);
}

// [FB] sample_file is either a .wav file or a sample directory
const usagesAsync = async function(sample_file) {
//    let is_dir = fs.lstatSync(sample_file).isDirectory();
    let relative_sample_file_name = slash(path.relative(cardRootPath(), sample_file));

    var all;
    const cached = usage_cache.find(el => { return el.key == relative_sample_file_name});
    
    if(mover.getSyncOps() || !cached){
        const songs = await scan_dir_async(relative_sample_file_name, path.join('/','SONGS'));
        const synths = await scan_dir_async(relative_sample_file_name, path.join('/','SYNTHS'));
        const kits = await scan_dir_async(relative_sample_file_name, path.join('/','KITS'));
    
        /*
        const songs = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath(), 'SONGS'));
        const synths = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath(), 'SYNTHS'));
        const kits = await scan_dir_async(relative_sample_file_name, path.join(cardRootPath(), 'KITS'));
        */
    
        all = songs.concat(synths, kits);
        add_cache({ 'key':relative_sample_file_name, 'usage':all });
    } else {
        console.log('found cached');
        all = cached.usage;
    }

    console.log(sample_file);
    console.log(all);
    return all;

}

exports.usagesAsync = usagesAsync;
