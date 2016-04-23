var ordermanager = require('./ordermanager');

module.exports = function(blip){
    
    blip.addTradingApi({
        '/account': function(args){
            
        },
        '/orders': function(args){
            
        },
        '/positions': function(args){
            
        },        
        '/createorder': function(args){
            
        },        
        '/cancelorder': function(args){
            
        }    
    });
    
    // // Returns account information
    // blip.addCommandHandler('/account', function(args){
        
    // });
    
    // // all open orders
    // blip.addCommandHandler('/orders', function(args){
        
    // });
    
    // // all positions
    // blip.addCommandHandler('/positions', function(args){
        
    // });
    
    // // current exposure
    // blip.addCommandHandler('/exposure', function(args){
        
    // });
    
    // // create order
    // blip.addCommandHandler('/co', function(args){
        
    // });
    
    // // create grid
    // blip.addCommandHandler('/cg', function(args){
        
    // });
    
    // // cancel
    // blip.addCommandHandler('/cc', function(args){
        
    // });
    
}