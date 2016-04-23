var util = require("util");
var events = require("events");
var path = require('path');
var request = require('request');
var Promise = require('bluebird');

var TradingAPI = function(trading_plugin){    
    events.EventEmitter.call(this);
    TradingAPI.prototype._init.call(this, trading_plugin);    
}

util.inherits(TradingAPI, events.EventEmitter);

TradingAPI.prototype._init = function(trading_plugin){
    
}

module.exports = TradingAPI;