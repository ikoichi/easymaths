/**
 * Module dependencies.
 */

var express = require('express');
var oauth = require('oauth');
var sys = require('sys');
var mongodb = require("mongodb"),
    mongoserver = new mongodb.Server('127.0.0.1', 27017, {auto_reconnect: true}),
    db_connector = new mongodb.Db('personal', mongoserver, {});

db_connector.open(function(){});

var Constants = require('./constants.js');
var Model = require('./functions.js');

var app = express();

var _twitterConsumerKey = Constants.TWITTER_CONSUMER_KEY;
var _twitterConsumerSecret = Constants.TWITTER_CONSUMER_SECRET;
var _twitterCallback = Constants.TWITTER_CALLBACK;

Model.set_constants({
  oauth: oauth,
  _twitterConsumerKey: _twitterConsumerKey,
  _twitterConsumerSecret: _twitterConsumerSecret,
  _twitterCallback: _twitterCallback,
  db_connector: db_connector
});

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
    
    var op = Model.get_operation();

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
    
    var data = Model.get_user_stats(req.params.name, function(err,stats){
        if(err){
            res.send('Error');
        }
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

app.get('/rank', function(req, res){

    if( typeof(req.session.user) == 'undefined' ){
      res.redirect('/');
      return;
    }
    
    var data = Model.get_ranking(function(err,rank){
        if(err){
            res.send('Error');
        }
        res.render(
          'rank', 
          { 
            user: req.session.user,
            rank: rank
          }, 
          function(err, html){
            res.send(html);
        });
    });

});

app.get('/twitterlogin',function(req,res){
  Model.consumer().getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
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
  Model.consumer().getOAuthAccessToken(req.session.oauthRequestToken, req.session.oauthRequestTokenSecret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
    if (error) {
      res.send("Error getting OAuth access token : " + sys.inspect(error) + "["+oauthAccessToken+"]"+ "["+oauthAccessTokenSecret+"]"+ "["+sys.inspect(results)+"]", 500);
    } else {
      req.session.oauthAccessToken = oauthAccessToken;
      req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
      // Right here is where we would write out some nice user stuff
      Model.consumer().get("https://api.twitter.com/1.1/account/verify_credentials.json", req.session.oauthAccessToken, req.session.oauthAccessTokenSecret, function (error, data, response) {
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
  Model.save_to_mongo(data, "contare", function(){
    Model.get_user_stats(req.session.user, function(err, stats){
      stats.user = req.session.user;
      Model.update_to_mongo(
        { user: req.session.user },
        stats,
        'statistics'
      );
    })
  });

  res.json({ 'result': succeded, 'answer': result });
});

app.listen(3000);
console.log("Express server listening on port 3000 in %s mode", app.settings.env);



