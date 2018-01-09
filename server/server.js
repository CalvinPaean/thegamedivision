const express = require('express');
const hbs = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const moment = require('moment');//timestamp
const config = require('./config/config').get(process.env.NODE_ENV);
const app = express();

//#################### HBS SETUP ########################//
app.engine('hbs', hbs({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: __dirname + './../views/layouts',
    partialsDir: __dirname + './../views/partials'
}));
app.set('view engine', 'hbs');


//#################### Database ########################//
mongoose.Promise = global.Promise;
mongoose.connect(config.DATABASE);

//MODELS
const {User} = require('./models/user');
const {Article} = require('./models/article');
const {UserReview} = require('./models/user_reviews');

//MIDDLEWARE
app.use('/css', express.static(__dirname + './../public/css'));
app.use('/js', express.static(__dirname + './../public/js'));
const {auth} = require('./middleware/auth');

app.use(bodyParser.json());//for the POST method since we will get json data.

app.use(cookieParser());

//GET
app.get('/', (req, res)=>{
    Article.find().sort({_id: 'asc'}).limit(10).exec((err, doc)=>{
        if(err) return res.status(400).send(err);
        res.render('home', {
            articles: doc
        });
    });
    
})

app.get('/register', auth, (req, res)=>{
    if(req.user) return res.redirect('/dashboard');
    res.render('register');
});

app.get('/login', auth, (req, res)=>{
    if(req.user) return res.redirect('/dashboard');
    res.render('login');
});

app.get('/games/:id', auth, (req, res)=>{
    let addReview = req.user ? true : false;
    Article.findById(req.params.id, (err, article)=>{
        if(err) return res.status(400).send(err);
        UserReview.find({'postId':req.params.id}).exec((err, userReviews)=>{
            res.render('article', {
                date: moment(article.createdAt).format('MM/DD/YY'),
                article, //ES6
                review: addReview,
                userReviews
            });
        });
        
    })
})


app.get('/dashboard', auth, (req, res)=>{
    if(!req.user) return res.redirect('/login');
    res.render('dashboard', {
        dashboard: true,//if you are in dashboard or not
        isAdmin: req.user.role === 1 ? true : false //if the user is admin or common user
    });
})

app.get('/dashboard/articles', auth, (req, res)=>{
    if(!req.user) return res.redirect('/login');
    res.render('admin_articles', {
        dashboard: true,//if you are in dashboard or not
        isAdmin: req.user.role === 1 ? true : false //if the user is admin or common user
    });
});

app.get('/dashboard/reviews', auth, (req, res)=>{
    if(!req.user) return res.redirect('/login');
    //req.user is from auth
    UserReview.find({'ownerId':req.user._id}).exec((err, userReviews)=>{
        
        res.render('admin_reviews', {
            dashboard: true,//if you are in dashboard or not
            isAdmin: req.user.role === 1 ? true : false, //if the user is admin or common user
            userReviews: userReviews
        });
    });
});

app.get('/dashboard/logout', auth, (req, res)=>{
    req.user.deleteToken(req.token, (err, user)=>{
        if(err) return res.status(400).send(err);
        res.redirect('/');
    });
});

//POST
app.post('/api/register', (req, res)=>{
    const user = new User(req.body);
    user.save((err, doc)=>{
        if(err) return res.status(400).send(err);
        user.generateToken((err, user)=>{
            if(err) return res.status(400).send(err);
            res.cookie('auth', user.token).send('ok');//set a cookie, name is auth and value is user.token

        });

    });
});

app.post('/api/login', (req, res)=>{
    User.findOne({'email':req.body.email}, (err, user)=>{
        if(!user) return res.status(400).json({message:'Auth failed. Wrong email!'});
        user.comparePassword(req.body.password, function(err, isMatch){
            if(err) throw err;
            if(!isMatch){
                return res.status(400).json({message:'Auth failed. Wrong password!'});
            }
            user.generateToken((err, user)=>{
                if(err) return res.status(400).send(err);
                res.cookie('auth', user.token).send('ok');//set a cookie, name is auth and value is user.token
                
            });
        });
    });
});


app.post('/api/add_article', auth, (req, res)=>{
    const article = new Article({
        ownerUsername: req.user.username,
        ownerId: req.user._id,
        title: req.body.title,
        review: req.body.review,
        rating: req.body.rating
    });
    article.save((err, doc)=>{
        if(err) return res.status(400).send(err);
        res.status(200).send();
    });
})

app.post('/api/user_review', auth, (req, res)=>{
    const userReview = new UserReview({
        postId: req.body.id,
        ownerUsername: req.user.username,
        ownerId: req.user._id,
        titlePost: req.body.titlePost,
        review: req.body.review,
        rating: req.body.rating
    });

    userReview.save((err, doc)=>{
        if(err) return res.status(400).send(err);
        res.status(200).send();
    });
})


app.listen(config.PORT, ()=>{
    console.log(`Started at port ${config.PORT}`);
});

