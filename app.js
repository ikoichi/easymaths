/**
 * Module dependencies.
 */

var express = require('express');
var oauth = require('oauth');
var sys = require('sys');
var mongodb = require("mongodb"),
    mongoserver = new mongodb.Server('127.0.0.1', 27017, {}),
    db_connector = new mongodb.Db('dbname', mongoserver, {});

var app = express();

var _twitterConsumerKey = 'abcdefghilmno';
var _twitterConsumerSecret = 'abcdefghilmnoabcdefghilmnoabcdefghilmnoabcdefghilmno';

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: '$contare!' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
  app.use(express.logger());
  app.use(express.session());
});

/*
app.configure('production', function(){
  app.use(express.errorHandler()); 
});
*/

// Routes
app.get('/', function(req, res){
    res.render('index', {}, function(err, html){
      if( req.session.user ){
        res.redirect('/user/'+req.session.user);
      }
      else{
        res.send(html);
      }
  });
});
app.get('/logout', function(req, res){
    delete req.session.user;
    res.redirect('/');
});
app.get('/user/:name', function(req, res){
    
    var op = get_operation();
    console.log('session user',req.session.user);
    console.log('user',req.params.name);
    console.log('op',op);

    if( typeof(req.session.user) == 'undefined' || req.session.user != req.params.name ){
      res.redirect('/');
      return;
    }

    res.render(
      'op', 
      { 
        user: req.params.name,
        operation: op
      }, 
      function(err, html){
        res.send(html);
    });
});

app.get('/user/:name/stats', function(req, res){
    
    var data = get_user_stats(req.params.name, function(err,stats){
        if(err){
            res.send('Error');
        }
        console.log(stats);
        res.render(
          'userstats', 
          { 
            user: req.params.name,
            sess_name: req.session.user,
            stats: stats
          }, 
          function(err, html){
            res.send(html);
        });
    });

});

app.get('/twitterlogin',function(req,res){
  consumer().getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
    if (error) {
      res.send("Error getting OAuth request token : " + sys.inspect(error), 500);
    } else {
      req.session.oauthRequestToken = oauthToken;
      req.session.oauthRequestTokenSecret = oauthTokenSecret;
      res.redirect("https://twitter.com/oauth/authenticate?oauth_token="+req.session.oauthRequestToken);
    }
  });
});

app.get('/twitter', function(req, res){
  sys.puts(">> oauthRequestToken "+req.session.oauthRequestToken);
  sys.puts(">> oauthRequestTokenSecret "+req.session.oauthRequestTokenSecret);
  sys.puts(">> oauth_verifier "+req.query.oauth_verifier);
  consumer().getOAuthAccessToken(req.session.oauthRequestToken, req.session.oauthRequestTokenSecret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
    if (error) {
      res.send("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
    } else {
      req.session.oauthAccessToken = oauthAccessToken;
      req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
      // Right here is where we would write out some nice user stuff
      consumer().get("https://api.twitter.com/1.1/account/verify_credentials.json", req.session.oauthAccessToken, req.session.oauthAccessTokenSecret, function (error, data, response) {
        if (error) {
          res.send("Error getting twitter screen name : " + sys.inspect(error), 500);
        } else {
          var data = JSON.parse(data);
          req.session.user = data.screen_name;

          req.method = 'get'; 
          res.redirect('/user/'+req.session.user); 
        }
      });
    }
  });
});

app.post('/check', function(req, res){
  var data = req.body;
  console.log(req.body);

  a = data.a;
  b = data.b;
  operator = data.operator;
  if (operator == "+")
    result = parseInt(a) + parseInt(b);
  else if (operator == "-")
    result = parseInt(a) - parseInt(b);
  else if (operator == "/")
    result = Math.floor(parseInt(a) / parseInt(b));
  else if (operator == "x")
    result = parseInt(a) * parseInt(b);

  if (data['answer'] == result)
    succeded = true;
  else
    succeded = false;

  data['succeeded'] = succeded;
  data['date'] = new Date().getTime();
  save_to_mongo(data, "contare");

  res.json({ 'result': succeded, 'answer': result });
});

app.listen(3000);
console.log("Express server listening on port 3000 in %s mode", app.settings.env);


function consumer() {
  return new oauth.OAuth(
    "https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
    _twitterConsumerKey, _twitterConsumerSecret, "1.0A", "http://your_hostname/twitter", "HMAC-SHA1");
}

function get_user_stats(user, callback){
    var stats = {
        success: 0,
        failed: 0,
        average_time: 0
    };
    var tot_ops = 0;
    var tot_time = 0;
    get_from_mongo('contare', { user: user }, function(err,data){
        if(err){
            if( typeof(callback) == 'function' ){
                console.log('get_user_stats',stats);
                callback(err);
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

        stats.average_time = limit_decimal( (tot_time / tot_ops / 1000), 1);
        if( typeof(callback) == 'function' ){
            console.log('get_user_stats',stats);
            callback(null,stats);
        }
        
  });
}

function get_from_mongo(collection, query, callback){
    var results = new Array();
    console.log(query);
    db_connector.open(function(err, db){
        db.collection(collection, function(err, coll){
            coll.find(query).toArray(function(err, docs) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, docs);
                }
                db.close();
            });

        });  
    });
}


function save_to_mongo(data, collection){
    db_connector.open(function(err, db){
        db.collection(collection, function(err, coll){
            coll.insert(data);
            db.close();
        });  
    });
  
}

function get_operation(){
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
}

function limit_decimal(num, limit){
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
