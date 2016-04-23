var util = require("util");
var events = require("events");
var Big = require('bignumber.js');
var _ = require('lodash');
var moment = require('moment');
var Hashids = require('hashids');
var hashids = new Hashids("oid:"+moment().valueOf(), 8, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
var id = 0;

function getId(){
  return hashids.encode(++id);
}

var logging_stub =  {info: function(){}, child: function(){ return logging_stub;}};

function LocalOrderManager(init) {
  var self = this;
  events.EventEmitter.call(this);
  LocalOrderManager.prototype._init.call(this, init||{});
}

util.inherits(LocalOrderManager, events.EventEmitter);

LocalOrderManager.prototype._init = function(options){
  var self = this;
  this.logger = options.logger || logging_stub;
  this.isLive = options.isLive ? true : false;
  this.orders = [];
  this.positions = [];
  this.closedPositions = [];
  this.account = options.account;
  this.marketData = options.marketData;
  if (this.marketData){
    this.marketData.on('tick', function(tick){
        self.tick.call(self, tick);
    });
  } else {
    process.nextTick(function(){
       self.emit('error', 'market data missing');     
    });        
  }
}

LocalOrderManager.prototype.getOrderTable = function(){
  return this.orders.concat(this.positions).concat(this.closedPositions);
}

LocalOrderManager.prototype.getOrder = function(id){
  if (!id) return false;
  var _id = id.indexOf('|') ? id.split('|')[0] : id;
  return this.orders.concat(this.positions).filter(function(o){
    return o.id == _id;
  })[0];
}

LocalOrderManager.prototype.getPositions = function(){
  return this.positions;
}

LocalOrderManager.prototype.getPositionDetail = function(){
  var shortPositions = 0,
    longPositions = 0,
    shortPL = new Big(0),
    longPL = new Big(0),
    shortVol = 0,
    longVol = 0,
    shortDDPips = 0,
    longDDPips = 0;

    this.positions.forEach(function(p){
      if (p.direction == 'buy')
      {
        longPositions++;
        longPL = longPL.plus(p.pl.times(p.lot));
        longVol += p.lot;
        longDDPips = Math.min(shortDDPips, p.pl);
      }
      else if (p.direction == 'sell')
      {
        shortPositions++;
        shortPL = shortPL.plus(p.pl.times(p.lot));
        shortVol += p.lot;
        shortDDPips = Math.min(shortDDPips, p.pl);
      }
    });

    var profit = new Big(0);
    this.closedPositions.forEach(function(p){
      profit = profit.plus(p.profit);
    });

    return {
      longCnt: longPositions,
      shortCnt: shortPositions,
      shortPL: shortPL,
      longPL: longPL,
      shortVol: shortVol,
      longVol: longVol,
      longDDPips: longDDPips,
      shortDDPips: shortDDPips,
      closedPL: profit,
      closedOrders: this.closedPositions.length
    };
}



LocalOrderManager.prototype.getPosition = function(id){
  var _id = id.indexOf('|') ? id.split('|')[0] : id;
  return this.orders.concat(this.positions).filter(function(o){
    return o.id == _id;
  })[0];
}

LocalOrderManager.prototype.createLimitOrder = function(tick, order){
  _normalizeOrder(order);
  if (order.expiration){ // if expiration is set (as minutes), then set explicit expiration
    order.exp = order.expiration;
    order.expiration = moment(tick.moment).add(order.expiration, 'm');
  }
  var newOrder = _.merge(order, { symbol: tick.symbol, otime: tick.time });
  newOrder.id = getId();
  this.orders.push(newOrder);
  return newOrder;
}

LocalOrderManager.prototype.clearBook = function(){
  var self = this;
  var orders = this.orders.slice();
  this.orders = [];
  orders.forEach(function(o){
    self.emit('order_cancelled', o);
  });
}

LocalOrderManager.prototype.cancelOrder = function(id){
  var order;
  this.orders = this.orders.filter(function(o){
    if (o.id == id){
      order = o;
      return false;
    }
    return true;
  });
  if (order){
    this.emit('order_cancelled', order);
  }
  return order;
}

LocalOrderManager.prototype.closePosition = function(tick, id){
  var self = this;
  var pos = this.positions.filter(function(p){
    return p.id == id;
  });
  if (pos.length == 1){
    pos = pos[0];
    var type = _getOrderDirection(pos);
    var closePrice = type == 'buy' ? tick.bidNum : tick.askNum;
    _closePosition.call(self, tick, pos, closePrice);
  }
}

LocalOrderManager.prototype.modifyPosition = function(id, tp, sl, tick){
  var self = this;
  var pos = this.positions.filter(function(p){
    return p.id == id;
  });
  if (pos.length == 1){
    pos = pos[0];
    var type = _getOrderDirection(pos);
    var pipSize = tick.pipSize;
    if (typeof tp !== 'undefined'){
      pos.tp = new Big(tp);
    } else if(tp === null){
      pos.tp = type == 'buy' ? new Big(99999) : new Big(0);
    }
    if (typeof sl !== 'undefined'){
      pos.sl = new Big(sl);
    } else if(sl === null){
      pos.sl = type == 'buy' ? new Big(0) : new Big(99999);
    }
    this.emit('position_modifed', pos);
  }
}

LocalOrderManager.prototype.closeAllPositions = function(tick){
  var self = this;
  this.positions.slice().forEach(function(pos){
    var type = _getOrderDirection(pos);
    var closePrice = type == 'buy' ? tick.bidNum : tick.askNum;
    _closePosition.call(self, tick, pos, closePrice);
  });
}

LocalOrderManager.prototype.closeAllPositionsOfDirection = function(tick, direction){
  var self = this;
  this.positions.slice().filter(function(p){ return p.direction == direction; }).forEach(function(pos){
    var type = _getOrderDirection(pos);
    var closePrice = type == 'buy' ? tick.bidNum : tick.askNum;
    _closePosition.call(self, tick, pos, closePrice);
  });
}

LocalOrderManager.prototype.tick = function(tick){
  var self = this;
  var pipSize = tick.pipSize;
  this.orders.filter(function(order){
    return order.symbol == tick.symbol;
  }).forEach(function(order){
    // Delete order if expired
    if (order.expiration && order.expiration.diff(tick.moment) < 0){
      _removeOrder.call(self, order);
      self.emit('order_expired', order);
      return;
    }
    if (self.isLive) return;
    switch(order.type){
      case 'buy_limit':
        if (tick.askNum.lessThanOrEqualTo(order.price)){
          _createPosition.call(self, tick, order);
        }
        break;
      case 'sell_limit':
        if (tick.bidNum.greaterThanOrEqualTo(order.price)){
          _createPosition.call(self, tick, order);
        }
        break;
      case 'buy_stop':
        if (tick.askNum.greaterThanOrEqualTo(order.price)){
          _createPosition.call(self, tick, order);
        }
        break;
      case 'sell_stop':
        if (tick.bidNum.lessThanOrEqualTo(order.price)){
          _createPosition.call(self, tick, order);
        }
        break;
      default:
        break;
    }
  });
  this.positions.filter(function(order){
    return order.symbol == tick.symbol;
  }).forEach(function(position){
    var type = position.direction;
    switch(type){
      case 'buy':
        position.pl = tick.bidNum.minus(position.openprice).div(pipSize).minus(_getFeeInPips(position.symbol));
        if (self.isLive) return;
        if (tick.bidNum.greaterThanOrEqualTo(position.tp)){
          _closePosition.call(self, tick, position, tick.bidNum);
          self.emit('tp_hit', position);
        } else if (tick.bidNum.lessThanOrEqualTo(position.sl)) {
          _closePosition.call(self, tick, position, tick.bidNum);
          self.emit('sl_hit', position);
        }
        break;
      case 'sell':
        position.pl = position.openprice.minus(tick.askNum).div(pipSize).minus(_getFeeInPips(position.symbol));;
        if (self.isLive) return;
        if (tick.askNum.lessThanOrEqualTo(position.tp)){
          _closePosition.call(self, tick, position, tick.askNum);
          self.emit('tp_hit', position)
        } else if (tick.askNum.greaterThanOrEqualTo(position.sl)) {
          _closePosition.call(self, tick, position, tick.askNum);
          self.emit('sl_hit', position);
        }
        break;
      default:
        break;
    }
  });
}





module.exports = LocalOrderManager;

/*

  Private methods

*/

function _removeOrder(order){
  this.orders = this.orders.filter(function(o){
    return (o.id !== order.id);
  });
}

var fees = {
  'eurusd':0.6,
  'nzdusd':0.4
};

function _getFeeInPips(symbol){
    var fee = fees[symbol];
    if(!fee){
      fee = 0.5;
    }
    return fee;
}

function _createPosition(tick, order){
  var type = _getOrderDirection(order);
  var pipSize = tick.pipSize;
  order.etime = tick.moment;
  order.openprice = type == 'buy' ? tick.askNum : tick.bidNum;
  order.tp = type == 'buy' ? tick.bidNum.plus(order.tp.times(pipSize)) :  tick.askNum.minus(order.tp.times(pipSize));
  order.sl = type == 'buy' ? tick.bidNum.minus(order.sl.times(pipSize)) :  tick.askNum.plus(order.sl.times(pipSize));
  order.pl = type == 'buy' ? tick.bidNum.minus(order.openprice).div(pipSize) : order.openprice.minus(tick.askNum).div(pipSize);
  order.spread = tick.spread;

  this.positions.push(order);
  // remove from order list
  this.orders = this.orders.filter(function(o){
    return o.id != order.id;
  });
  this.emit('order_filled', order);
}

function _closePosition(tick, position, closeprice){
  var type = _getOrderDirection(position);
  var pipSize = tick.pipSize;
  position.ctime = tick.time;
  position.closeprice = closeprice;
  position.profit = type == 'buy' ?
    position.closeprice.minus(position.openprice).div(pipSize).times(position.lot):
    position.openprice.minus(position.closeprice).div(pipSize).times(position.lot);
  this.closedPositions.push(position);
  // remove from position list
  this.positions = this.positions.filter(function(pos){
    return pos.id != position.id;
  });
  this.emit('position_closed', position);
}

function _normalizeOrder(order){
  if (order.tp){
    order.tp = new Big(order.tp);
  }
  if (order.sl){
    order.sl = new Big(order.sl);
  }
  if (order.price){
    order.price = new Big(order.price);
  }
  order.direction = _getOrderDirection(order);
  order.lot = Number(new Big(order.lot).toFixed('2'));
}

function _getOrderDirection(o){
  return o.type.indexOf('buy') > -1 ? 'buy' : 'sell';
}
