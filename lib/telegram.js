var util = require("util");
var events = require("events");
var path = require('path');
var request = require('request');
var Promise = require('bluebird');

var Telegram = function(init) {    
    events.EventEmitter.call(this);
    Telegram.prototype._init.call(this, init||{});    
}

util.inherits(Telegram, events.EventEmitter);

Telegram.prototype._init = function(options) {
    var self = this;
    this.url = options.url || "not set";
    this.apiKey = options.apiKey || "not set";
    this.updateOffset = 0;
    this.polling = !!options.nopoll;
    this.commandHandlers = {};
    this.commandPipelines = {};
    this.requestCount = 0;    
    this.getUpdateInterval = setInterval(function() {
        if (self.polling === false) {
            console.log('running getUpdateInterval');
            self.polling = true;
            self.getUpdates()
            .then(function(updates) {
                self._parseUpdates(updates);
            }).finally(function() {
                console.log('result polling flag');
                self.polling = false;
            });
        }
    }, 1000);
    
    // Always have a command that reports all registered commands.
    this.addCommandHandler('/commands', function() {
       var msg = "Commands:";
       msg += Object.keys(this.commandHandlers).join('\n-');
       return msg;        
    });
}

Telegram.prototype._parseUpdates = function(updates) {
    
// Update format
// {"ok":true,"result":[{"update_id":683320991,
//   "message":{ 
//         "message_id":121,
//         "from":{ "id":104405457,"first_name":"---","username":"---"},
//         "chat":{ "id":104405457,"first_name":"---","username":"---","type":"private"},
//         "date":1460069382,
//         "text":"\/status"}
//        }]}

    var self = this;        
    (updates && updates.result ? updates.result : [] ).forEach(function(record) {        
        // update message offset
        if ( record.update_id >=  self.updateOffset) {
            self.updateOffset = record.update_id + 1;
        }        
        var chatId = record.message.chat.id;
        
        // If whitelist is defined, only response to messages from whitelisted members
        // you don't want everyone to be able to control your bot
        if (config.telegram.user_whitelist && config.telegram.user_whitelist.length > 0) {
            if (config.telegram.user_whitelist.indexOf(chatId) == -1) {
                return;
            }
        }
        
        var messageText = record.message.text; 
        if (messageText[0] == '/') { // commands
            var parts = messageText.split(' ');
            
            // TODO:  handle command pipelines first
            //var cb = self.commandPipelines[parts[0]];
            
            var cb = self.commandHandlers[parts[0]]; 
            // if a command is found for this action, then execute it
            if (cb) {
                var commandResult = cb.apply(null, parts.slice(1));
                // handle async with promises
                if (commandResult instanceof Promise) {
                    commandResult.then(function(result) {
                        handleCommandResult(result);    
                    }).catch(function(err) {
                        console.log('callback failed', err, messageText);
                    });
                }
                else {
                    handleCommandResult(commandResult);
                }                
            }
        } else {  // keyboard responses?
            // https://core.telegram.org/bots/api#callbackquery
            //TODO:  if message has .data, then handle it by looking through the commandPipelines
        }          
    });
    
}

Telegram.prototype.addCommandHandler = function(command, cb) {
    this.commandHandlers[command] = cb;   
}

Telegram.prototype.sendKeyboard = function(chatId, message) {
    this.makeRequest('sendMessage', {
        'chat_id': chatId,
        'text': message
    });
}

Telegram.prototype.sendMessage = function(chatId, message) {
    this.makeRequest('sendMessage', {
        'chat_id': chatId,
        'text': message
    });
}

Telegram.prototype.makeRequest = function(method, form) {
    var self = this;
    self.requestCount++;
    return new Promise(function(resolve, reject) {        
        var url = self.url + self.apiKey + "/" + method;        
        request.post({
            url: url,
            form: form,
        }, function(err, httpRes, body) {
            self.requestCount--;
            if (err) {                
                reject(err);
                self.emit('error', { error: err });            
            } else {
                resolve(JSON.parse(body));
            }
        });    
    });
}

Telegram.prototype.getUpdates = function(timeout) {
    var self = this;
    return this.makeRequest('getUpdates', 
        {
            offset: self.updateOffset, 
            timeout: timeout || 30
        })
        .then(function(updates) {
            // long poll collision
            if (updates.error_code == 409) {                
                console.log('long poll 409', updates.description);
                self.emit('error', 'long poll collision, ensure this is the only instance running.')
                delete updates.error_code;
                delete updates.description;
                updates.result = [];
            }            
            return updates;
        });
}

Telegram.prototype.exit = function() {
    var self = this;
    clearInterval(self.getUpdateInterval);    
    return new Promise(function(resolve, reject) {        
        var i = setInterval(function() {
            if (self.requestCount==0) {
                clearInterval(i);
                return resolve();
            }
        }, 300);
    });
}

module.exports = Telegram;


function handleCommandResult(commandResult) {
    if (typeof commandResult === 'string' ) {
        self.sendMessage(chatId, commandResult);                
    } else if (typeof commandResult === 'object') {
        // TODO: finished this
        self.sendKeyboard(chatId, )
    }
}