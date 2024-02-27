const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const ejsMate = require('ejs-mate');
const Note = require('./models/note');
const methodOverride = require('method-override');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user.js');
const flash = require('connect-flash');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const Todo = require('./models/todo');
const session = require('express-session');
const MongoStore = require('connect-mongo')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
let lastEmailSentTimestamp = null;
const Darkmode = require('darkmode-js');


const app = express();
const cron = require('node-cron');
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
require('dotenv').config();
require('./auth.js')
const moment = require('moment');
const { log } = require('console');

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please login first!');
  res.redirect('/login');
};






app.use(flash()); 

app.use(express.urlencoded({ extended: true }));

app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, '/public')));
app.set('views', path.join(__dirname, 'views'));

console.log(process.env.ATLAS_DB);








async function main() {
  await mongoose.connect(process.env.ATLAS_DB);
  console.log('Connected to DB');
}

main().catch((err) => 
  console.log(err)
);

const store = MongoStore.create({
  mongoUrl: process.env.ATLAS_DB,
  touchAfter: 24 * 60 * 60,
  crypto: {
    secret: process.env.SECRET
  }
})

store.on('error', function (e) {
  console.log('session store error', e)
})

app.use(
  session({
    store: store,
    secret: process.env.SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);



app.use(passport.initialize());
app.use(passport.session());

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

cron.schedule('* * * * *', async () => {
  try {
    // console.log('Cron job running...');

    const currentDate = new Date();
    // console.log('Current Date/Time:', currentDate.toISOString().slice(0, -5));

    const upcomingTodos = await Todo.find({
      dateTime: {
        $gte: currentDate,
        $lte: new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
      },
      emailSent: { $ne: true }
    });

    // console.log('Upcoming Todos:', upcomingTodos.map(todo => ({ 
    //   ...todo, dateTime: todo.dateTime.toISOString().slice(0, -5) 
    // })));

    if (upcomingTodos.length === 0) {
      console.log('No upcoming todos found.');
    }

    for (const todo of upcomingTodos) {
      // console.log('Sending email for todo:', todo._id);

      if (todo.emailSent) {
        console.log('Email already sent for this todo:', todo._id);
        continue; 
      }

      if (!todo.completed) {
        const oneMinute = 60 * 1000;
        const oneHour = 60 * 60 * 1000;
        const SixHours = 6 * 60 * 60 * 1000;
        const twelveHours = 12 * 60 * 60 * 1000;
        const oneDay = 24 * 60 * 60 * 1000;

        const timeDifference = moment(todo.DateTime).diff(currentDate, 'milliseconds');

        console.log('Current Date:', currentDate);

        if (timeDifference <= oneMinute && timeDifference >= -oneMinute) {
          await sendEmail(todo, `Reminder for todo: ${todo.title}`);
        } else if (timeDifference <= oneHour && timeDifference >= oneHour - 2 * oneMinute) {
          await sendEmail(todo, `Reminder for todo: ${todo.title} 1 hr left to complete`);
        } else if (timeDifference >= SixHours - 2 * oneMinute && timeDifference <= SixHours) {
          await sendEmail(todo, `Reminder for todo: ${todo.title} 6 hrs left to complete`);
        } else if (timeDifference >= twelveHours - 2 * oneMinute && timeDifference <= twelveHours) {
          await sendEmail(todo, `Reminder for todo: ${todo.title} 12 hrs left to complete`);
        } else if (timeDifference >= oneDay - 2 * oneMinute && timeDifference <= oneDay) {
          await sendEmail(todo, `Reminder for todo: ${todo.title} 1 day left to complete`);
        } else {
          console.log('Time abhi sahi nahi hua. Skipping email for todo:', note._id);
        }

        todo.emailSent = true;
        await todo.save();
      }
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});


async function sendEmail(todo, subject) {
  try {
    const user = await User.findById(todo.user);
    if (!user || !user.email) {
      console.error('Error: User or email not found for todo:', todo);
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD
      }
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: 'Notepad - Reminder',
      text: `Reminder for todo: ${todo.text}... please update it if you have not done it.\n link: http://localhost:3000/user/${todo.user}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);

    todo.emailSent = true;
    await todo.save();
    console.log('Mail marked as sent:', todo);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}



app.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body.user; 

    let newUser = new User({ email, username });

    const registeredUser = await User.register(newUser, password);

    await sendEmail(email);

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
    const { userId } = req.params;
    const currentUserID = req.user._id;

    await Todo.deleteMany({ note: userId });
    const deletedNote = await Note.findByIdAndDelete(userId);
    if (!deletedNote) {
      return res.status(404).send('Note not found');
    }
    req.flash('success', 'Note and associated todos deleted successfully!');
    res.redirect(`/user/${currentUserID}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

function randomcolor() {
  var letters = '0123456789ABCDEF';
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

app.get('/user/:userId', ensureAuthenticated, async (req, res) => {
  const currentUserID = req.user._id;
  try {
    const userNotes = await Note.find({ user: currentUserID });

    // Generate a random color for each note
    const colors = userNotes.map(() => randomcolor());

    res.render('note/index.ejs', { allNotes: userNotes, req, user: req.user, colors });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});







app.get('/user/:id/new', ensureAuthenticated, (req, res) => {
  let allTodos = req.user.todos;
  res.render('note/new.ejs',{allTodos});
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

app.get('/user/todolist', ensureAuthenticated, async (req, res) => {
  const noteId = req.session.noteId;  

    const title = await Note.find({ noteId }).select('title');
    if(title.lenght>0){
      const title = await Note.find({ noteId }).select('note');
    }
  res.render('note/todolist.ejs',{title});
});

//for showing all notes
// app.get('/user/:id/todos/', ensureAuthenticated, async (req, res) => {
//   const currentUserID = req.user._id;
//   try {
//     const userTodos = await Todo.find({ user: currentUserID });
//     const noteId = req.session.noteId;  

//     let titles = await Note.find({ _id: noteId }).select('title');
//     let title;

//     if (titles && titles.length > 0) {
//       title = titles[0].title;
//     } else {
//       // If the note doesn't have a title, you can use the note content
//       let note = await Note.find({ _id: noteId }).select('note');
//       console.log(note, "note");
//       title = note ? note[1].note : 'Untitled Note';
//     }

//     console.log(title);
//     res.render('note/todolist.ejs', { currentUser: req.user, allTodos: userTodos, title });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.post('/todoadd', async (req, res) => {
  try {
    const { text, dateTime } = req.body;

    const noteId = req.session.noteId;  
    console.log(noteId, "nodeId");
    console.log("NoteId:", noteId);
    const newTodo = new Todo({ text, user: req.user._id, note: noteId, dateTime });

    await newTodo.save();

    const note = await Note.findById(noteId);

    if (!note) {
      console.log("Note not found");
      return res.status(404).send('Note not found');
    }

    note.todos.push(newTodo._id);

    await note.save();

    res.redirect(`/user/note/${noteId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
app.get('/user/note/:noteId', ensureAuthenticated, async (req, res) => {
  const currentUserID = req.user._id;

  try {
    const { noteId } = req.params;

    console.log("sayd ye user ke id h",noteId);
    // Fetch the note based on the ID
    const note = await Note.findOne({ _id: noteId, user: currentUserID });

    if (!note) {
      return res.status(404).send('Note not found');
    }

    // Set noteId in the session
    req.session.noteId = note._id;

    // Fetch todos associated with the current note
    const allTodos = await Todo.find({ user: currentUserID, note: noteId });

    //associatedTodos
    const associatedTodos = await Todo.find({ note: note._id })
     const filteredTodos = allTodos.filter(todo => todo.note && todo.note.toString() === note._id.toString())
    //logging
    console.log('NoteId:', note._id)
    console.log('note:', JSON.stringify(note)) 
    console.log('Number of associatedTodos:', associatedTodos.length) 
    console.log('Number of filteredTodos:', filteredTodos.length)
    res.render('note/show.ejs', { req, note, allTodos, moment, Todo, NoteId: note._id,filteredTodos, associatedTodos});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});



// app.get('/user/note/:id', ensureAuthenticated, async (req, res) => {
//   const currentUserID = req.user._id;

//   try {
//     const { id } = req.params;

//     // Fetch the note based on the ID
//     const note = await Note.findOne({ _id: id, user: currentUserID });

//     if (!note) {
//       return res.status(404).send('Note not found');
//     }

//     // Set noteId in the session
//     req.session.noteId = note._id;

//     // Fetch todos associated with the current note
//     const allTodos = await Todo.find({ user: currentUserID, note: note._id });

//     // Pass both note and filtered todos to the template
//     res.render('note/show.ejs', { req, note, allTodos,note,Todo  });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.put('/user/:id/todos/:todoId', async (req, res) => {
  try {
    const { todoId } = req.params;
    const { text, date, time, completed } = req.body;
    const dateTimeString = `${date}T${time}:00`;
    const noteId = req.session.noteId;
    console.log('Combined DateTime String:', dateTimeString);
    const dateTime = new Date(dateTimeString);
    console.log('Parsed DateTime:', dateTime);
    const isCompleted = completed === 'on';

    const updatedTodo = await Todo.findByIdAndUpdate(
      todoId,
      { text, dateTime, completed: isCompleted },
      { new: true }
    );

    req.flash('success', 'Todo updated successfully!');
    res.redirect(`/user/note/${noteId}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error updating todo. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});

app.get('/user/:id/todos/:todoId', ensureAuthenticated , async (req, res) => {
  try {
    const { id,todoId } = req.params;
    const allTodos = await Todo.find({ user: req.user._id });
    const currentTodo = allTodos.find(todo => todo._id.toString() === todoId);
    req.session.noteId = id;
    console.log(  allTodos, currentTodo );
    res.render('note/edit-todo.ejs', { allTodos, currentTodo,moment, req });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// app.post('/user/:id/todos/:todoId', async (req, res) => {
//   try {
//     const { todoId } = req.params;
//     const { text, dateTime, completed } = req.body;
//     const dateTimeString = `${dateTime}:00`;
//     console.log('Combined DateTime String:', dateTimeString);
//     const parsedDateTime = new Date(dateTimeString);
//     console.log('Parsed DateTime:', parsedDateTime);
//     const isCompleted = completed === 'on';
//     const updatedTodo = await Todo.findByIdAndUpdate(
//       todoId,
//       { text, dateTime: parsedDateTime, completed: isCompleted },
//       { new: true }
//     );

//     req.flash('success', 'Todo updated successfully!');
//     res.redirect(`/user/${req.user._id}/todos`);
//   } catch (error) {
//     console.error(error);
//     req.flash('error', 'Error updating todo. Please try again.');
//     res.status(500).send('Internal Server Error');
//   }
// });

app.get('/user/:id/todos/:todoId/edit', ensureAuthenticated, async (req, res) => {
  try {
    const { id,todoId } = req.params;

    const currentTodo = await Todo.findOne({ _id: todoId, user: req.user._id });

    if (!currentTodo) {
      req.flash('error', 'Todo not found.');
      return res.redirect(`/user/${req.user._id}/todos`);
    }

    res.render('note/edit-todo.ejs', { currentTodo, moment, req });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});
  
  

app.delete('/user/:id/todos/:todoId', ensureAuthenticated, async (req, res) => {
  try {
    const { todoId,id } = req.params;
    console.log(id);
    const deletedTodo = await Todo.findByIdAndDelete(todoId);
    req.flash('success', 'Todo deleted successfully!');
    res.redirect(`/user/note/${id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error deleting todo. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});




app.get('/auth/google',
  passport.authenticate('google', { scope:
    ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
   }
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
