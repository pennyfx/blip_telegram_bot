var assert = require('chai').assert;
var os = require('os');
var path = require('path');
var _ = require('lodash');

var Telegram = require('../lib/telegram.js');
var config = require('config');

describe('telegram', function(){
    it('instantiate', function(done){
        var t = new Telegram(_.merge(config.telegram,{nopoll:true}));
        assert.isDefined(t);
        t.exit().then(done);        
    });
    describe('client', function(){
        var client;
        before(function(){
            client = new Telegram(_.merge(config.telegram,{nopoll:true}));
        })
        it('make request', function(done){
           client.makeRequest('getUpdates', {offset:0})
           .then(function(updates){
               assert.isArray(updates.result);               
               done();
           }).catch(function(err){
               done(err);
           })
        });
        it('getUpdates', function(done){
           client.getUpdates()
           .then(function(updates){
               assert.isArray(updates.result);      
               console.log(JSON.stringify(updates));         
               done();
           }).catch(function(err){
               done(err);
           });
        });        
        
        after(function(done){
            client.exit().then(done);
        })
    })
        
    describe('client-w-polling', function(){
        var client;
        before(function(){
            client = new Telegram(_.merge(config.telegram,{nopoll:false}));
        })
        it('responds to commands', function(done){
            var messageReceieved = false;
            console.log('type /test into telelgram channel')
            client.addCommandHandler('/test', function(){
                messageReceieved = true;
                return "foo";
            });            
            var i = setInterval(function(){
                if(messageReceieved){
                    clearInterval(i);
                    done();
                }
            }, 300);
        });
        after(function(done){
            client.exit().then(done);
        })
    })
});