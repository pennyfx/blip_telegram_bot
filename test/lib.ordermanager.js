var assert = require('chai').assert;
var os = require('os');
var path = require('path');

var OrderManager = require('../lib/ordermanager.js');

describe('ordermanager', function(){
    it('instantiate', function(done){
        var om = new OrderManager();        
        assert.isDefined(om);
        assert.isArray(om.getOrderTable());  
        done();      
    });
    it('should emit error if market data is missing', function(done){
        var om = new OrderManager();
        om.on('error', function(msg){
            done();
        });
    });
    it('', function(done){
        done();
    });
});