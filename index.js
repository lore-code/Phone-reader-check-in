var express    = require('express');
var readline   = require('readline');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('makers.db');
var bodyParser = require('body-parser')

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', function(input) {
  var data = input.toString();
  var makerId = data.slice(1,-1);
  db.get("SELECT card_id, name, checked_in FROM makers WHERE card_id = (?)", [makerId], function(err, maker) {
    if (err) {
      console.log("There was an error attempting to find this maker.");
      console.log(err);
    } else {
      if (maker) {
        if (maker.checked_in === 0) {
          // maker is checked out
          db.run("UPDATE makers SET checked_in = 1 WHERE card_id = (?)", [makerId], function(err) {
            console.log("Maker with maker ID " + makerId + " was checked in.");

            var stmt = db.prepare("INSERT INTO checkins VALUES (?, ?, ?)");
            stmt.run(makerId, new Date().toISOString(), null);
            stmt.finalize();
          });
        } else {
          // maker is checked in
          db.run("UPDATE makers SET checked_in = 0 WHERE card_id = (?)", [makerId], function(err) {
            console.log("Maker with maker ID " + makerId + " was checked out");

            db.get('SELECT rowid FROM checkins ORDER BY start_time DESC', function(err, checkin) {
              if (checkin) {
                var stmt = db.prepare("UPDATE checkins SET end_time = (?) WHERE rowid = (?)");
                stmt.run(new Date().toISOString(), checkin.rowid);
                stmt.finalize();
              }
            });
          });

        }

      } else {
        console.log('This maker was not found. Please register at /register.');
        io.emit('register-card', makerId);
      }
    }
  });
});

var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);

// set the view engine to ejs
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }))

app.get('/', function (req, res) {
  res.render('pages/index');
});

app.get('/makers.json', function(req, res) {
  db.all("SELECT card_id, name FROM makers", function(err, makers) {
    return res.json(makers);
  });
});

app.get('/checkedin_makers.json', function(req, res) {
  db.all("SELECT card_id, name FROM makers WHERE checked_in = 1", function(err, makers) {
    return res.json(makers);
  });
});

app.get('/checkins.json', function(req, res) {
  db.all("SELECT checkins.maker_id, checkins.start_time, checkins.end_time, makers.name FROM checkins, makers WHERE checkins.maker_id = makers.card_id ORDER BY start_time DESC", function(err, checkins) {
    return res.json(checkins);
  });
});

app.get('/register', function (req, res) {
  res.render('pages/register');
});

app.post('/register', function (req, res) {
  if (req.body.card_id && req.body.name) {
    var stmt = db.prepare("INSERT INTO makers VALUES (?, ?, ?)");
    stmt.run(req.body.card_id, req.body.name, 0);
    stmt.finalize();
    return res.redirect('/')
  } else {
    return res.redirect('/register');
  }
});


app.use(express.static('public'));

http.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});
