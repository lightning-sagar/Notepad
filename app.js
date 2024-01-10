const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejsMate = require('ejs-mate');
const Note = require('./models/note');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user.js');
const session = require('express-session');
const flash = require('connect-flash');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const Todo = require('./models/todo');
const MongoStore = require('connect-mongo');

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const app = express();
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
require('dotenv').config();
require('./auth.js')
const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please login first!');
  res.redirect('/login');
};

app.use(session({ 
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false, 
  cookie: {
    httpOnly: true,
    expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));


app.use(passport.initialize());


app.use(flash()); 

app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: true }));

app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public')));
app.set('views', path.join(__dirname, 'views'));

console.log(process.env.ATLAS_DB);

const db_url = process.env.ATLAS_DB






async function main() {
  await mongoose.connect(db_url);
  console.log('Connected to DB');
}

main().catch((err) => 
  console.log(err)
);


const store = MongoStore.create({
  mongoUrl: db_url,
  secret: process.env.SECRET,
  touchAfter: 24 * 60 * 60
})

store.on("error", function (e) {
  console.log("SESSION STORE ERROR", e)
})

app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentUser = req.user;
  next();
})

app.get('/', (req, res) => {
  if(req.isAuthenticated()){
    res.redirect(`/user/${req.user._id}`);
  }
  res.render('note/home.ejs');
})

app.get('/login', (req, res) => {
  res.render('users/login.ejs');
});

app.post('/login', passport.authenticate('local', { failureRedirect: '/login' , failureFlash: true }), (req, res) => {
  console.log(req.user);
  req.flash('success', 'Welcome back!');
  res.redirect(`/user/${req.user._id}`);
});

app.get('/signup', (req, res) => {
  res.render('users/signup.ejs', {
    error: req.flash('error'),
    success: req.flash('success'),
  });
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user:  process.env.EMAIL,
    pass: process.env.PASSWORD
  }
});

async function sendWelcomeEmail(email) {
  try {
    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Welcome to Your App',
      text: 'Thank you for registering on Your App. We look forward to providing you with great experiences!'
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent: ' + info.response);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
}

app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body.user; // Extract values from req.body.user

    let newUser = new User({ email, username });

    const registeredUser = await User.register(newUser, password);

    // Sending a welcome email
    await sendWelcomeEmail(email);

    req.login(registeredUser, (err) => {
      if (err) {
        console.error(err);
        req.flash('error', 'Error signing up');
        return res.redirect('/signup');
      }

      req.flash('success', 'Registration successful! Welcome to Wanderlust.');
      res.redirect('/user/' + registeredUser._id);
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Error signing up');
    res.redirect('/signup');
  }
});




app.post('/user/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { title, note } = req.body;
    const newNote = new Note({
      title,
      note,
      user: req.user._id,
    });
    await newNote.save();
    req.flash('success', 'Note added successfully!');
    res.redirect(`/user/${req.user._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding note. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});

app.put('/user/note/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, note } = req.body;
    const updatedNote = await Note.findByIdAndUpdate(id, { title, note }, { new: true });
    req.flash('success', 'Saved successfully!');
    res.redirect(`/user/${req.user._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating note. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});


app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
      res.render('users/login.ejs', { error: 'Error logging out. Please try again.' });
    }

    req.flash('success', 'You are logged out. Goodbye!');
    res.redirect('/');
  });
});


app.delete('/user/note/:userId', async (req, res) => {
  try {
    console.log('wprk');
    const { userId } = req.params;
    console.log(userId);
    const currentUserID = req.user._id;
    const deletedNote = await Note.findByIdAndDelete(userId);
    console.log(userId,"deleted");
    console.log(currentUserID);
    if (!deletedNote) {
      return res.status(404).send('Note not found');
    }
    req.flash('success', 'Note deleted successfully!');
    res.redirect(`/user/${currentUserID}`);
  }
  catch (error) {
    console.error(error);
  }
});

app.get('/user/:userId', ensureAuthenticated, async (req, res) => {
  const currentUserID = req.user._id;
  try {
    const userNotes = await Note.find({ user: currentUserID });
    res.render('note/index.ejs', { allNotes: userNotes }); 
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/user/note/:id', ensureAuthenticated, async (req, res) => {
  const currentUserID = req.user._id;
  try {
    const { id } = req.params;
    const note = await Note.findOne({ _id: id, user: currentUserID });
    if (!note) {
      return res.status(404).send('Note not found');
    }
    res.render('note/show.ejs', { note });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/user/:id/new', ensureAuthenticated, (req, res) => {
  res.render('note/new.ejs');
});



app.post('/user/:id', ensureAuthenticated, async (req, res) => {
  try {
    const { title, note } = req.body;
    const newNote = new Note({
      title,
      note,
      user: req.user._id,
    });
    await newNote.save();
    req.flash('success', 'Note added successfully!');
    res.redirect(`/user/${req.user._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding note. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});

app.get('user/todolist', ensureAuthenticated, (req, res) => {
  res.render('note/todolist.ejs');
})


app.get('/user/:id/todos/', ensureAuthenticated, async (req, res) => {
  const currentUserID = req.user._id;
  try {
    const userTodos = await Todo.find({ user: currentUserID });
    res.render('note/todolist.ejs', { currentUser: req.user, allTodos: userTodos });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



app.post('/todoadd', async (req, res) => {
  try {
    const { text } = req.body;
    console.log(req.user._id);
    const newTodo = new Todo({ text, user: req.user._id });
    await newTodo.save();
    res.redirect(`/user/${req.user._id}/todos`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.put('/user/:id/todos/:todoId', async (req, res) => {
  try {
    const { todoId } = req.params;
    const { text } = req.body;
    const updatedTodo = await Todo.findByIdAndUpdate(todoId, { text }, { new: true });
    req.flash('success', 'Todo updated successfully!');
    res.redirect(`/user/${req.user._id}/todos`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating todo. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});
app.get('/user/:id/todos/:todoId', async (req, res) => {
  const { todoId } = req.params;
  const allTodos = await Todo.find({ user: req.user._id });
  const currentTodo = allTodos.find(todo => todo._id.toString() === todoId);
  res.render('note/edit-todo.ejs', { allTodos, currentTodo });
});

app.post('/user/:id/todos/:todoId', async (req, res) => {
  try {
    console.log(req.params._todoId)
    const { todoId } = req.params;
    const { completed } = req.body;
    const updatedTodo = await Todo.findByIdAndUpdate(todoId, { completed }, { new: true });
    req.flash('success', 'Todo updated successfully!');
    res.redirect(`/user/${req.user._id}/todos`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating todo. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});


app.delete('/user/:id/todos/:todoId', async (req, res) => {
  try {
    const { todoId } = req.params;
    const deletedTodo = await Todo.findByIdAndDelete(todoId);
    req.flash('success', 'Todo deleted successfully!');
    res.redirect(`/user/${req.user._id}/todos`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error deleting todo. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});


app.delete('/user/:id/deleteAll', async (req, res) => {
  try {
    console.log(req.user._id);
    await Note.deleteMany({ user: req.user._id });
    req.flash('success', 'All notes deleted successfully!');
    res.redirect(`/user/${req.user._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error deleting notes. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});



app.get('/auth/google',
  passport.authenticate('google', { scope:
      [ 'email', 'profile' ] }
));

app.get( '/auth/google/callback',
    passport.authenticate( 'google', {
        successRedirect: '/auth/google/success',
        failureRedirect: '/auth/google/failure'
}));

app.get('/auth/google/success', (req, res) => {
  console.log(req.user);
  req.flash('success', 'Authenticated with Google successfully!');
  res.redirect(`/user/${req.user._id}`);
});

app.get('/auth/google/failure', (req, res) => {
  req.flash('error', 'Failed to authenticate with Google. Please try again.');
  res.redirect('/signup')
})

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});