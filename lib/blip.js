var util = require("util");
var events = require("events");
var path = require('path');
var request = require('request');
var Promise = require('bluebird');
var config = require('config');
var TradingAPI = require('./trading_api');
var Telegram = require('./telegram');

var Blip = function(init){    
    events.EventEmitter.call(this);
    Blip.prototype._init.call(this, init||{});    
}

util.inherits(Blip, events.EventEmitter);

Blip.prototype._init = function(){
    var self = this;
    this.telegram = new Telegram(config.telegram);
    this.tradingAPI = new TradingAPI(config.trading_api);    
};

Blip.prototype.addCommandHandler = function(command, cb){    
    var fn = this.telegram.commandHandlers[command];
    if (fn){
        var temp = fn;
        fn = function(msg){
            return temp(cb(msg));
        }
    }
    this.telegram.commandHandlers[command] = fn;
}

Blip.prototype.addCommandPipeline = function(commandPipeline){
    var fn = this.telegram.commandHandlers[commandPipeline.trigger];
    if (fn){
        commandPipeline.__nextFn = fn;        
    }     
    // TODO: this needs refinement.  
    // checkMessage should be called on all messages that have .callback_data
    // so this should be moved into the telegram bot 
    this.telegram.commandHandlers[commandPipeline.trigger] = function(msg){
        return commandPipeline.checkMessage(msg)
        .then(function(obj){
            if (typeof obj == 'function'){
                var result = obj();
                return commandPipeline.___nextFn(result);
            } else {
                return obj;
            }
        }).catch(function(err){
            console.log('cgeckMessage result fail', err);
        });     
    };
}

module.exports = Blip;

