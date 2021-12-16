const path = require('path');
const electron = require('electron');
const app = electron.app;
const settings = require('electron-settings');
const ElectronPreferences = require('electron-preferences');

const preferences = new ElectronPreferences({
    'dataStore': path.resolve(app.getPath('userData'), 'deluge-cmd-preferences.json'),
    'defaults':{
      'prefs':{
        'display':[
          "waveform_show",
          "sync_operations"
        ]
      }
    },
    'sections':[
      /*
      {
        'id':'card',
        'label':'SD card',
        'icon': 'folder-15',
        'form':{
          'groups':[
            {
              'fields':[
                {
                  'label':'SD card root',
                  'key': 'folder',
                  'type': 'directory',
                  'help': 'Deluge SD card root folder'
                }
              ]
            }
          ]
        }
      },
      */
      {
        'id':'prefs',
        'label':'Preferences',
        'icon': 'preferences',
        'form':{
          'groups':[
            {
              'fields': [
                {
                  'label':'Display options',
                  'key':'display',
                  'type':'checkbox',
                  'options':[
                    {
                        'label':'Show sample waveforms (slower)','value':'waveform_show'
                    },
                    {
                        'label':'Rescan card after operations (slower but safer)',
                        'value':'sync_operations'
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    ]
  });

  preferences.on('save', (preferences) => {
      // [FB] hack for ubiquitos access to preferences (use settings module, much better made)
    settings.set('waveform_show', prefEnabled('prefs.display','waveform_show'))
    settings.set('sync_operations', prefEnabled('prefs.display','sync_operations'))
//    console.log(app.getPath('userData'))
//    console.log(`Preferences were saved.`, JSON.stringify(preferences, null, 4));
  });
  
  module.exports = preferences;

  let prefEnabled = function(key,val){
    return preferences.value(key).indexOf(val)>-1;
  }

  