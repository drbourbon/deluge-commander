import { app, BrowserWindow } from 'electron';
const settings = require('electron-settings');
const mover = require('./mover.js');

const argv = require('yargs')
  .command({
    command: 'move <sample_file> <destination_folder>',
    desc: 'Move sample between folders',
    handler: (argv)=>{
      mover.usages(argv.sample_file);
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

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const createWindow = () => {
	let cardRootPath = settings.get('card_root');
	let isCalledViaCLI = checkIfCalledViaCLI(process.argv);

//	console.log("deluge card root: " + cardRootPath);

	if(isCalledViaCLI) {
		mainWindow = new BrowserWindow({ show: false, width: 0, height: 0});

		if(argv.card_root){
			settings.set('card_root', argv.card_root);
			cardRootPath = argv.card_root;
    }
    
    if(argv.move){

    }

		app.quit();
	} else {
    mainWindow = new BrowserWindow({ show: true, width: 640, height: 480});
    
    // and load the index.html of the app.
    mainWindow.loadURL(`file://${__dirname}/index.html`);

    // Open the DevTools.
    mainWindow.webContents.openDevTools();
	}


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
  if (process.platform !== 'darwin') {
    app.quit();
  }
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