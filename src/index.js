import { addBypassChecker } from 'electron-compile';

import { app, BrowserWindow, dialog } from 'electron';
const WindowStateManager = require('electron-window-state-manager');
const settings = require('electron-settings');
const mover = require('./mover.js');

const argv = require('yargs')
  .command({
    command: 'usages <sample_file>',
    desc: 'List references of <sample_file> in Deluge SD card folders',
    handler: (argv)=>{
      const occ = mover.usages(argv.sample_file);
      console.log(occ.join(', '));
      app.quit();
    }
  })
  .command({
    command: 'move <sample_file> <destination_path>',
    desc: 'Move <sample_file> to another folder',
    handler: (argv)=>{
      try {
        const occ = mover.usages(argv.sample_file);
        console.log(`Moving ${argv.sample_file} to ${argv.destination_path} and updating references in: ${occ.join(', ')}`);
        mover.move(argv.sample_file, argv.destination_path, occ);
      } catch (error) {
        console.log('Error moving sample: ' + error.message);
      }
      app.quit();
    }
  })
  .argv;

function checkIfCalledViaCLI(args){
	if(args && args.length > 2){
		return true;
	}
	return false;
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// [FB] THIS IS WORKAROUND FOR LOCAL FILE ACCESS: https://github.com/electron-userland/electron-compile/pull/199
addBypassChecker((filePath) => {
  return /\.WAV/.test(filePath.toUpperCase());
});

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const mainWindowState = new WindowStateManager('mainWindow', {
  defaultWidth: 1024,
  defaultHeight: 768
});

const createWindow = () => {
	let cardRootPath = settings.get('card_root');
	let isCalledViaCLI = checkIfCalledViaCLI(process.argv);

  if(argv.card_root && mover.validRootPath(argv.card_root)){
    settings.set('card_root', argv.card_root);
    cardRootPath = argv.card_root;
  }

  if(!cardRootPath || ! mover.validRootPath(cardRootPath)){
    let choosen_root_path = dialog.showOpenDialog({properties: ['openDirectory']});
    if(choosen_root_path && mover.validRootPath(choosen_root_path[0])) {
      settings.set('card_root', choosen_root_path[0]);
      cardRootPath = choosen_root_path;
    } else {
      cardRootPath = null;
    }
  }

  if(!cardRootPath){
    dialog.showErrorBox('error','Invalid Deluge SD card root');
    app.quit();
    return;
  }

  console.log("Deluge card root set to " + cardRootPath);

  if(argv.disable_waveforms){
    settings.set('disable_waveforms', argv.disable_waveforms === 'true');
  }
  console.log("Waveform display: " + !settings.get('disable_waveforms'));


	if(isCalledViaCLI) {
		mainWindow = new BrowserWindow({ show: false, width: 0, height: 0});
		app.quit();
	} else {
    mainWindow = new BrowserWindow({ 
      show: true, 
      width: mainWindowState.width, 
      height: mainWindowState.height,
      webPreferences: {
        webSecurity: true,
        allowRunningInsecureContent: false,
        webaudio:true,
      }
    });
    
    if (mainWindowState.maximized) {
      mainWindow.maximize();
    }

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    // Open the DevTools.
    //mainWindow.webContents.openDevTools();
	}

  mainWindow.on('close', () => {
    if(!isCalledViaCLI){
      mainWindowState.saveState(mainWindow);
    }
  });

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {

    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q

  app.quit();

  /*
  if (process.platform !== 'darwin') {
    app.quit();
  }
  */
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
