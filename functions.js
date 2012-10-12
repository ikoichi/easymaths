module.exports = {
	set_constants: function(obj){
		for( var i in obj ){
			this[i] = obj[i];
		}
	},
	consumer: function() {
	  return new this.oauth.OAuth(
	    "https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
	    this._twitterConsumerKey, this._twitterConsumerSecret, "1.0A", this._twitterCallback, "HMAC-SHA1");
	},
	get_user_stats: function(user, callback){
		var that = this;
	    var stats = {
	        success: 0,
	        failed: 0,
	        average_time: 0
	    };
	    var tot_ops = 0;
	    var tot_time = 0;
	    this.get_from_mongo('contare', { user: user }, function(err,data){
	        if(err){
	            if( typeof(callback) == 'function' ){
	                callback(err);
	                return;
	            }
	        }
	        data.forEach(function(doc) {
	            if(doc != null){
	                // do something.
	                if( doc.succeeded ){
	                    stats.success++
	                }
	                else{
	                    stats.failed++   
	                }
	                tot_ops++;
	                tot_time += parseInt(doc.time);
	            }
	        });

	        stats.average_time = that.limit_decimal( (tot_time / tot_ops / 1000), 1);
	        if( typeof(callback) == 'function' ){
	            callback(null,stats);
	        }
	        
	  });
	},
	get_ranking: function(callback){
		this.get_from_mongo('statistics',{},function(err, data){
			if(err){
	            if( typeof(callback) == 'function' ){
	                callback(err);
	                return;
	            }
	        }
	        var rank = new Array();
	        data.forEach(function(doc) {
	            if(doc != null){
	                // do something.
	                rank.push({
	                	user: doc.user,
	                	diff: doc.success - doc.failed,
	                	success: doc.success,
	                	failed: doc.failed,
	                	average_time: doc.average_time
	                });
	            }
	        });

	        rank.sort(function(a,b){
	        	if( a.diff == b.diff ){
	        		return a.average_time > b.average_time;
	        	}
	        	else{
	        		return a.diff < b.diff;
	        	}
	        })

	        if( typeof(callback) == 'function' ){
	            callback(null,rank);
	        }
		})
	},
	get_from_mongo: function(collection, query, callback){
	    var results = new Array();
	    //this.db_connector.open(function(err, db){
	        this.db_connector.collection(collection, function(err, coll){
	            coll.find(query).toArray(function(err, docs) {
	                if (err) {
	                    callback(err);
	                } else {
	                    callback(null, docs);
	                }
	                //db.close();
	            });

	        });  
	    //});
	},
	save_to_mongo: function(data, collection, callback){
	    //this.db_connector.open(function(err, db){
	        this.db_connector.collection(collection, function(err, coll){
	            coll.insert(data);
	            //db.close();
	            if( typeof(callback) == 'function' ){
	            	callback();
	            }
	        });  
	    //});
	  
	},
	update_to_mongo: function(find,obj,collection){
		//this.db_connector.open(function(err, db){
	        this.db_connector.collection(collection, function(err, coll){
	            coll.update(
	            	find,
	            	obj,
	            	{
	            		upsert: true,
	            		safe: false
	            	}
	            );
	            //db.close();
	        });  
	    //});
	},
	get_operation: function(){
	  var operators = ["+","-","/","x"];
	  var op_index = Math.floor(Math.random()*4);
	  var op = operators[op_index];
	  var a = Math.floor(Math.random()*100)+1;
	  if(op == "/")
	    b = Math.floor(Math.random()*10)+1;
	  else if(op == "x")
	    b = Math.floor(Math.random()*10)+1;
	  else
	    b = Math.floor(Math.random()*100)+1;

	  switch(op){
	    case '+':
	      result = parseInt(a)+parseInt(b);
	    break;
	    case '-':
	      result = parseInt(a)-parseInt(b);
	    break;
	    case '/':
	      result = Math.floor(parseInt(a)/parseInt(b));
	    break;
	    case 'x':
	      result = parseInt(a)*parseInt(b);
	    break;
	  }

	  var data = {
	    "operation": op,
	    "a": a,
	    "b": b,
	    "result": result,
	    "date": new Date().getTime()
	  };

	  return data
	},
	limit_decimal: function(num, limit){
	    num = ""+num;
	    var arr_num = num.split(".");
	    if (num.indexOf(".") != -1){
	        if (arr_num[1].length < limit){
	            var dif = arr_num[1].length - limit;
	            for (var i = 0; i < dif; i++) {
	                num += '0';
	            };
	            
	        }
	        else{
	            num = arr_num[0] + "." + arr_num[1].substring(0, limit);
	        }
	        num = parseFloat(num);
	    }
	    else{
	        num = parseInt(num);
	    }
	    return num;
	}
};
