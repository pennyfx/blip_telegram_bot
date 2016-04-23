var config = require('config');

// TODO:  How is this going to work ?

// Gets updates and responds to them accordingly
// allows plugins to intercept and act on various commands

var blip = {};

config.plugins.forEach(function(pluginPath){
    var plugin = require(pluginPath);
    plugin(blip);
});
