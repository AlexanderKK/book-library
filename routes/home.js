let express = require('express');

let router = express.Router();

// const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

sqlite3 = require('sqlite3');
db = new sqlite3.Database('library.sqlitedb');
db.serialize();
db.run(`CREATE TABLE IF NOT EXISTS books(
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    genre TEXT NOT NULL,
    price MONEY NOT NULL,
    user_id INTEGER NOT NULL,
    date_created TEXT,
    date_modified TEXT)`
);

db.run(`CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        date_created TEXT,
        date_modified TEXT)`);


//Login form
router.get('/login', function(req, res) {

        res.render('login', {info: 'Please Login'});

});


//Register form
router.get('/register', function(req, res) {

        res.render('register', {info: 'Please Register'});

});


//Login session with 'express-session'
session = require('express-session');

router.use(session({

    secret: 'random string',

    resave: true,

    saveUninitialized: true,

}));


//Login
bcrypt = require('bcryptjs');

// users = require('./passwd.json');

router.post('/login', async function(req, res) {
        await db.get("SELECT password FROM users WHERE username = ?", req.body.username, (err, userData) => {
                if(userData != null) {
                        let passwordIsPresent = bcrypt.compareSync(req.body.password, userData.password);

                        if(passwordIsPresent) {
                                req.session.username = req.body.username;
        
                                req.session.count = 0;
        
                                res.redirect("/home/");
                        } else {
                                // console.error();
                                res.render('login', {warn: 'Incorrect user input'});
                        }
                } else {
                        res.render('login', {warn: 'Incorrect user input'});
                }
        });
});

//Register
router.post('/register', async function(req, res) {
        await db.get(`SELECT id FROM users WHERE username = ?`, req.body.username, (err, userData) => {
                if(userData == null) {
                        db.run(`
                        INSERT INTO users(
                            username,
                            password,
                            date_created,
                            date_modified
                        ) VALUES (
                            ?,
                            ?,
                            DATETIME('now','localtime'),
                            DATETIME('now','localtime')
                        );`,
        
                        [req.body.username, bcrypt.hashSync(req.body.password, 10)],
        
                        (err) => {
                            if(req.body.username != "" && req.body.password != "") {
                                req.session.username = req.body.username;
                                req.session.count = 0;
        
                                res.redirect("/home/");
                            } else {
                                res.render('register', {wrongInput: 'Incorrect user input'});
                            }
                        });
                } else {
                        res.render('register', {wrongInput: 'User already exists'});
                }
        });
});


router.all('*', function (req, res, next) {
        if (!req.session.username) {
            res.redirect("/home/login");
            return;
        }
        next();
});

//Logout
router.get('/logout', (req, res) => {
        
        console.log(req.session.username)
        req.session.destroy();
        

        res.redirect("/home/login");

});


//Get info for current user and session count and current date
router.get('/', function(req, res, next) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        
        req.session.count++;

        s = "User: " + req.session.username + " Count: " + req.session.count + " " + new Date();

        if(typeof req.session.username !== "undefined" || req.session.username) {
                db.get(`SELECT id FROM users WHERE username = ?`, req.session.username, (err, userData) => {
                        if(userData != null) {
                                db.all(`SELECT * FROM books WHERE user_id = ?`, userData.id, function (err, books) {
                                        if (err) throw err;
                
                                        res.render('home', { info: s, userLogged: req.session.username, books: books});
                                });
                        }
                });
        } else {
                res.render('login');
        }
});

router.post('/add', (req, res) => {
        db.get(`SELECT id FROM users WHERE username = ?`, req.session.username, (err, user_id) => {
                trimContent(req.body);
  
                db.run(`
                INSERT INTO books(
                        title,
                        author,
                        genre,
                        price,
                        user_id,
                        date_created,
                        date_modified
                ) VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        DATETIME('now','localtime'),
                        DATETIME('now','localtime')
                );`, [req.body.title, req.body.author, req.body.genre, Number(req.body.price).toFixed(2), user_id.id],
        
                (err) => {
                        res.redirect("/home/");
                });
               
                // res.render('home', {warn: 'Invalid book data'});
        });
});

router.post('/update', (req, res) => {

        trimContent(req.body);

        db.run(`UPDATE books SET title=?, author=?, genre=?, price=?, date_modified = DATETIME('now','localtime') WHERE id=?`, 
        [req.body.title, req.body.author, req.body.genre, Number(req.body.price).toFixed(2), req.body.id],

        (err) => {
                res.redirect("/home/");
        });
        
});

function trimContent(requestBody) {
        if(requestBody.title.trim() == "") {
                requestBody.title = 'Unknown';
        }
        
        if(requestBody.author.trim() == "") {
                requestBody.author = 'Unknown';
        }

        if(requestBody.genre.trim() == "") {
                requestBody.genre = 'None';
        }

        if(requestBody.price.trim() == "" || !isFinite(requestBody.price)) {
                requestBody.price = '0';
        }

        requestBody.title = requestBody.title.trim();
        requestBody.author = requestBody.author.trim();
        requestBody.genre = requestBody.genre.trim();
        requestBody.price = requestBody.price.trim();
}

router.post('/delete', (req, res) => {

        db.run(`DELETE FROM books WHERE id=?`,
                req.body.id,
                (err) => {
                    if (err) throw err;

                    res.redirect("/home/");
                });
});

router.post('/search', function(req, res) {
        if(typeof req.session.username !== "undefined" || req.session.username) {
                db.get(`SELECT id FROM users WHERE username = ?`, req.session.username, (err, userData) => {
                        if(userData != null) {
                                if(typeof req.body.title === "undefined") {
                                        req.body.title = "";
                                }

                                if(typeof req.body.author === "undefined") {
                                        req.body.author = "";
                                }
                                
                                if(typeof req.body.genre === "undefined") {
                                        req.body.genre = "";
                                }

                                db.all(`SELECT * FROM books WHERE user_id = ? AND title LIKE ? AND author LIKE ? AND genre LIKE ?`, 
                                userData.id, `%${req.body.title}%`, `%${req.body.author}%`, `%${req.body.genre}%`, function (err, books) {
                                        
                                        if (err) throw err;
                                        // console.log(req.body.title, req.body.genre, req.body.author);

                                        res.send({ info: s, userLogged: req.session.username, books: books });
                                });
                        }
                });
        } else {
                res.render('login');
        }
});


module.exports = router;