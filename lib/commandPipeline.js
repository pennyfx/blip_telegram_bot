var _ = require('lodash');
var Hashids = require('hashids');
var hashids = new Hashids("cpl:"+moment().valueOf(), 8, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
var id = 0;

function getId(){
  return hashids.encode(++id);
}


var CommandPipeline = function(init){
    this.id = getId();
    this.trigger = init.trigger;
    this.prompts = init.prompts;
    this.onComplete = init.onComplete;
    this.position = 0;
    this.blip;
}

CommandPipeline.prototype.register = function (blip){
    var self = this;
    this.blip = blip;
    this.blip.addCommandHandler(this.trigger, function(){
        self.position = 0;
        self.sendNextPrompt();       
    });
};

CommandPipeline.prototype.checkMessage = function (message){
    var self = this;
    return new Promise(function(resolve, reject){
        var data = message.callback_data;
        if (data) {
            // parse the callback_data and see if this pipeline should handle it
            var parts = data.split("_");
            if (parts.length > 0 && parts[0] === self.id){
                var name = parts[1];
                var value = parts[2];
                var prompt = self.prompts[self.position];            
                if (prompt){
                    if (prompt.name == name){
                        prompt.value = value; 
                        self.position++;
                        resolve(self.sendNextPrompt());
                    } else { // does not match, which step is this message for?  so confused right now
                        reject("no match");
                    }
                } else {
                    console.log('No prompt found', self.position);
                    reject("no prompt");                
                }
            } else {
                reject("no match");
            }
        } else {
            reject("no callback data");
        }    
    });
};

CommandPipeline.prototype.sendNextPrompt = function (){
    var self = this;    
    return new Promise(function(resolve, reject){
        var prompt = self.prompts[self.position];
        // if we're at the last prompt, fire onComplete with the results 
        if (self.position >= self.prompts.length) {
            self.position = 0;
            // collect results
            var obj = {};
            self.prompts.forEach(function(p){
                obj[p.name] = p.value;
            })
            // return a function with the obj that can be executed 
            // then return the result to blip
            resolve(function(){
                return self.onComplete.call(this, obj);
            });
        } else if (prompt) {
            // returns object, which means we need to send a message
            resolve(self.craftPrompt(prompt));
        } else {
            console.log('why are we here?', self.position);
            reject("how did this happen?");
        }
    });
}

CommandPipeline.prototype.craftPrompt = function (prompt){
    // TODO: construct message for telegram
    return {};
    
}

module.exports = CommandPipeline;


var OrderCreationPipeline = new CommandPipeline({
   "trigger": "/createorder",
   "prompts": [
       {
           "name": "entry",
           "message": "Select entry price",
           "keyboard": function(){
               // find current price and return the keyboard
           }
       },
       {
           "name": "risk",
           "message": "Select Risk Percent",
           "keyboard": [
               [
                    {text:"0.5%",callback_data:"0.5"},
                    {text:"1.0%",callback_data:"1.0"},
                    {text:"2.0%",callback_data:"2.0"},
                    {text:"3.0%",callback_data:"3.0"}
               ]
           ]
       },
       {
           "name": "tp",
           "message": "Select take profit (pips)",
           "keyboard": [
               [
                    {text:"10",callback_data:"10"},
                    {text:"15",callback_data:"15"},
                    {text:"20",callback_data:"20"},
                    {text:"50",callback_data:"50"}
               ]
           ]
       },
       {
           "name": "sl",
           "message": "Select stop loss (pips)",
           "keyboard": [
               [
                    {text:"10",callback_data:"10"},
                    {text:"15",callback_data:"15"},
                    {text:"20",callback_data:"20"},
                    {text:"50",callback_data:"50"}
               ]
           ]
       }
   ],
   onComplete: function(results){
       // returns the results of all your questions
       // Do some work with it, then return something 
   }
});


var OrderGridPipeline = new CommandPipeline({
   "trigger": "/createordergrid",   
   "onComplete": function(results){
       // returns the results of all your questions
       // Do some work with it, then return something
       
   },
   "prompts": [
       {
           "name": "entry",
           "message": "Select entry price",
           "keyboard": function(){
               // find current price and return the keyboard
           }
       },
       {
           "name": "lot_progression",
           "message": "Lot progression",
           "keyboard": [
               [
                    {text:"1,2,3",callback_data:"123"},
                    {text:"1,2,4",callback_data:"124"},
                    {text:"1,2,1",callback_data:"121"}
               ],
               [
                    {text:"3,2,1",callback_data:"321"},
                    {text:"4,2,1",callback_data:"421"},
                    {text:"1,1,1",callback_data:"111"}
               ],
               
           ]
       },
       {
           "name": "order_spacing",
           "message": "Order spacing",
           "keyboard": [
               [
                    {text:"5",callback_data:"5"},
                    {text:"10",callback_data:"10"},
                    {text:"15",callback_data:"15"}
               ],
               [
                    {text:"20",callback_data:"20"},
                    {text:"25",callback_data:"25"},
                    {text:"30",callback_data:"30"}
               ]               
           ]
       },
       {
           "name": "risk",
           "message": "Select Risk Percent",
           "keyboard": [
               [
                    {text:"0.5%",callback_data:"0.5"},
                    {text:"1.0%",callback_data:"1.0"},
                    {text:"2.0%",callback_data:"2.0"},
                    {text:"3.0%",callback_data:"3.0"}
               ]
           ]
       },
       {
           "name": "tp",
           "message": "Select take profit (pips)",
           "keyboard": [
               [
                    {text:"10",callback_data:"10"},
                    {text:"15",callback_data:"15"},
                    {text:"20",callback_data:"20"},
                    {text:"50",callback_data:"50"}
               ]
           ]
       },
       {
           "name": "sl",
           "message": "Select stop loss (pips)",
           "keyboard": [
               [
                    {text:"10",callback_data:"10"},
                    {text:"15",callback_data:"15"},
                    {text:"20",callback_data:"20"},
                    {text:"50",callback_data:"50"}
               ]
           ]
       }
   ]
});