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
const session = require('express-session');
const MongoStore = require('connect-mongo')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
let lastEmailSentTimestamp = null;
const Darkmode = require('darkmode-js');
const notifier = require('node-notifier');

const app = express();
const cron = require('node-cron');
const moment = require('moment-timezone'); 
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
require('dotenv').config();
require('./auth.js')
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

// console.log(process.env.ATLAS_DB);








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
    store,
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
    // Get the current date and time in IST (GMT+5:30)
    const currentDateTime = new Date();
    console.log('Current Date and Time:', currentDateTime);

    const upcomingTodos = await Note.find({
      StartTime: {
        $gte: new Date(currentDateTime.getTime() - 5 * 60 * 1000), // 5 minutes before StartTime
        $lte: new Date(currentDateTime.getTime() + 24 * 60 * 60 * 1000) // 24 hours after StartTime
      },
      emailSent: { $ne: true }
    });

    console.log('Upcoming Todos:', upcomingTodos);

    if (upcomingTodos.length === 0) {
      console.log('No upcoming todos found.');
    }

    for (const note of upcomingTodos) {
      if (!note.completed) {
        // Convert todo start time and end time to UTC
        const startTimeUTC = new Date(note.StartTime);
        const endTimeUTC = new Date(note.EndTime);

        const timeDifferenceStart = startTimeUTC.getTime() - currentDateTime.getTime();
        const timeDifferenceEnd = endTimeUTC.getTime() - currentDateTime.getTime();

        console.log('Current Date:', currentDateTime);
        console.log('Todo StartTime:', startTimeUTC);
        console.log('Todo EndTime:', endTimeUTC);
        console.log('Time difference to start:', timeDifferenceStart);
        console.log('Time difference to end:', timeDifferenceEnd);

        if (Math.abs(timeDifferenceStart) <= 5 * 60 * 1000 && timeDifferenceStart >= 0) {  
          await sendEmail(note, `Reminder for todo: ${note.title} - 5 minutes before StartTime`);
          await notification(`Reminder for todo: ${note.title} - 5 minutes before StartTime`);
          note.emailSent = true;
        }
        if (Math.abs(timeDifferenceEnd) <= 5 * 60 * 1000 && timeDifferenceEnd >= 0) {  
          await sendEmail(note, `Reminder for todo: ${note.title} - 5 minutes before EndTime`);
          note.emailSent = true;
        }

        await note.save();
      }
    }
  } catch (error) {
    console.error('Error in cron job:', error);
  }
});

async function notification(subject) {
  notifier.notify({
    title: 'Notification',
    message: subject
  });
}

async function sendEmail(note, subject) {
  try {
    const user = await User.findById(note.user);
    if (!user || !user.email) {
      console.error('Error: User or email not found for todo:', note);
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
      subject: `Notepad - Reminder : ${subject}`,
      text: `Reminder for todo: ${note.title}... `,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.response);
    console.log('Mail marked as sent:', note);
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
    console.log(req.body);
    const { startTime, endTime, title, note } = req.body;
    const StartTime = new Date(startTime); 
    const EndTime = new Date(endTime); 
    const currentTime = moment();
    const isStartTimeValid = moment(StartTime).isAfter(currentTime);
    const isEndTimeValid = moment(EndTime).isAfter(currentTime);
    if (!isStartTimeValid || !isEndTimeValid) {
      req.flash('error', 'Invalid time. Please select a valid time.');
      return res.redirect(`/user/${req.user._id}/new`);
    }
    let existingNotes = await Note.find({
      user: req.user._id,
      $or: [
        { $and: [{ StartTime: { $lte: StartTime } }, { EndTime: { $gte: StartTime } }] }, // New note starts within existing note
        { $and: [{ StartTime: { $lte: EndTime } }, { EndTime: { $gte: EndTime } }] },     // New note ends within existing note
        { $and: [{ StartTime: { $gte: StartTime } }, { EndTime: { $lte: EndTime } }] }    // New note completely overlaps with existing note
      ]
    });
    console.log(existingNotes,"already exit the same time??");
    if (existingNotes.length > 0) {
      for(let i = 0; i < existingNotes.length; i++) {
          req.flash('error', 'Time clash with existing note. Please select different times.');
          return res.render(`note/new`, { existingNotes,req });
        }
    }
    const newNote = new Note({
      StartTime,
      EndTime,
      title,
      note,
      user: req.user._id,
    });
    await newNote.save();
    existingNotes=[] 
    req.flash('success', 'Note added successfully!');
    res.redirect(`/user/${req.user._id}`);
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding note. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});

app.post('/user/:noteId/freeTime', ensureAuthenticated, async (req, res) => {
  try {
      const userId = req.params.noteId;
      const freeTime = req.body.date;
      const month = freeTime.slice(5, 7);
      const date = freeTime.slice(8, 10);
      const formattedDate = `${month}-${date}-${new Date().getFullYear()}`;
      
      const startOfDayUTC = new Date(freeTime);
      startOfDayUTC.setUTCHours(6, 30, 0, 0);
      const endOfDayUTC = new Date(startOfDayUTC);  
      endOfDayUTC.setUTCHours(18, 29, 59, 999);   


      console.log(startOfDayUTC, endOfDayUTC, "this will be the start and end of day");

      const userEvents = await Note.find({
          user: userId,
          completed: false,
          StartTime: { $gte: startOfDayUTC, $lte: endOfDayUTC }
      });

      userEvents.sort((a, b) => a.StartTime - b.StartTime);

      const freeTimeSlots = [];
      let startTimeUTC = startOfDayUTC;

      for (const event of userEvents) {
          const eventStartTimeUTC = event.StartTime;

          const duration = moment(eventStartTimeUTC).diff(startTimeUTC);

          if (duration > 0) {
              freeTimeSlots.push({ startTime: startTimeUTC.toISOString(), endTime: eventStartTimeUTC.toISOString() });
          }

          startTimeUTC = event.EndTime;
      }

      if (moment(endOfDayUTC).diff(startTimeUTC) > 0) {
          freeTimeSlots.push({ startTime: startTimeUTC.toISOString(), endTime: endOfDayUTC.toISOString() });
      }

      console.log(freeTimeSlots, "this will be the free time slots");

      res.render('note/free.ejs', { freeTimeSlots, req, noteId: userId });
  } catch (error) {
      console.error(error);
      req.flash('error', 'Error fetching free time. Please try again.');
      res.status(500).send('Internal Server Error');
  }
});

app.get('/user/:noteId/freetime', ensureAuthenticated, async (req, res) => {
    try{
      console.log(req.params.noteId);
      res.render('note/free.ejs', { freeTimeSlots:[],req, noteId: req.params.noteId });
    } catch (error) {
      console.error(error);
      req.flash('error', 'Error fetching free time. Please try again.');
      res.status(500).send('Internal Server Error');
  }
})

app.get('/user/:userId/complete', ensureAuthenticated, async (req, res) => {
  try {
    const currentUserID = req.params.userId;
    const userNotes = await Note.find({ user: currentUserID, completed: true });
    let title = "Completed Notes"; // Change the title to reflect completed notes

    res.render('note/complete.ejs', { allNotes: userNotes, req, user: req.user, title });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error fetching completed notes. Please try again.');
    res.status(500).send('Internal Server Error');
  }
});

app.get('/user/:userId/search', ensureAuthenticated, async (req, res) => {
  try {
    const currentUserID = req.params.userId;
    let { title } = req.query; // Use let instead of const for title
    const userNotes = await Note.find({ title: { $regex: title, $options: 'i' } });

    console.log(userNotes.length, "length");

    let date = [];

    if (userNotes.length === 0) {
      let searchDate;
      try {
        const year = new Date().getFullYear();
        const searchDateString = year + "-" + title; // Concatenate with current year
        searchDate = new Date(searchDateString);

        if (isNaN(searchDate.getTime())) {
          throw new Error('Invalid date');
        }

        console.log(searchDate, "date");

        // Get the start and end of the provided date
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);

        date = await Note.find({ 
          $or: [
            { StartTime: { $gte: startOfDay, $lte: endOfDay } },
            { EndTime: { $gte: startOfDay, $lte: endOfDay } }
          ]
        });
      } catch (error) {
        console.error('Error parsing date:', error);
        searchDate = null;
      }
    }

    if (userNotes.length === 0 && (!date || date.length === 0)) {
      title = "No matches found";
    }

    res.render('note/search.ejs', { allNotes: userNotes.concat(date), req, user: req.user, title });
  } catch (error) {
    console.error(error);
    req.flash('error', 'Error adding note. Please try again.');
    res.status(500).render('note/search.ejs', { allNotes: [], req, user: req.user, title: "Error" });
  }
});





app.post('/user/note/:id/completed', ensureAuthenticated, async (req, res) => {
  try{
    const { id } = req.params;
    const completed = true
    console.log(id,completed);

    const updatedNote = await Note.findByIdAndUpdate(id, { completed }, { new: true });
    console.log(updatedNote, "updated");

    req.flash('success', 'Saved successfully!');
    res.redirect(`/user/${req.user._id}`);
  }
  catch (error) {
    console.error(error);
    req.flash('error', 'Error adding note. Please try again.');
    res.status(500).send('Internal Server Error');
  }
})
app.post('/user/note/:id/uncompleted', ensureAuthenticated, async (req, res) => {
  try{
    const { id } = req.params;
    const completed = false
    console.log(id,completed);

    const updatedNote = await Note.findByIdAndUpdate(id, { completed }, { new: true });
    console.log(updatedNote, "updated");

    req.flash('success', 'Saved successfully!');
    res.redirect(`/user/${req.user._id}/complete`);
  }
  catch (error) {
    console.error(error);
    req.flash('error', 'Error adding note. Please try again.');
    res.status(500).send('Internal Server Error');
  }
})

app.put('/user/note/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { StartTime, EndTime, title, note, completed } = req.body;
    const startTime = new Date(StartTime);
    const endTime = new Date(EndTime);
    const currentTime = new Date();
    const isStartTimeValid = startTime > currentTime;
    const isEndTimeValid = endTime > currentTime;

    if (!isStartTimeValid || !isEndTimeValid) {
      req.flash('error', 'Invalid time. Please select a valid time.');
      return res.redirect(`/user/${req.user._id}`);
    }

    const existingNotes = await Note.find({
      user: req.user._id,
      $or: [
        { $and: [{ StartTime: { $lte: StartTime } }, { EndTime: { $gte: StartTime } }] },
        { $and: [{ StartTime: { $lte: EndTime } }, { EndTime: { $gte: EndTime } }] },
        { $and: [{ StartTime: { $gte: StartTime } }, { EndTime: { $lte: EndTime } }] }
      ]
    });

    if (existingNotes.length > 0) {
      if(existingNotes[0]._id.toString() !== id) {
        console.log(existingNotes[0]._id.toString(), id,"\n\n\nthese were the id...\n\n\n");
        req.flash('error', 'Time clash with existing note. Please select different times.');
        return res.redirect(`/user/${req.user._id}`);
      }
    }

    const isCompleted = completed === 'on';

    const updatedNote = await Note.findByIdAndUpdate(id, { StartTime:startTime, EndTime:endTime, completed: isCompleted, title, note }, { new: true });
    console.log(updatedNote, "updated");
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
    console.log(req.params, "note id");
    const { userId } = req.params;
    const currentUserID = req.user._id;

    // await Todo.deleteMany({ note: userId });
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

app.get('/user/:userId', ensureAuthenticated, async (req, res) => {
  const currentUserID = req.user._id;
  try {
    
    const userNotes = await Note.find({
       user: currentUserID,
       completed: false
      });
    const  title  = "All Notes";  
    res.render('note/index.ejs', { allNotes: userNotes, req, user: req.user,title});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/user/:id/new', ensureAuthenticated, async (req, res) => {
  let existingNotes = []
  res.render('note/new.ejs', { req, user: req.user,existingNotes});
})

// app.get('/user/todolist', ensureAuthenticated, async (req, res) => {
//   const noteId = req.session.noteId;  

//     const title = await Note.find({ noteId }).select('title');
//     if(title.lenght>0){
//       const title = await Note.find({ noteId }).select('note');
//     }
//   res.render('note/todolist.ejs',{title});
// });

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

// app.post('/todoadd', async (req, res) => {
//   try {
//     const { text, DateTime } = req.body;

//     const noteId = req.session.noteId;  
//     console.log(noteId, "nodeId");
//     console.log("NoteId:", noteId);
//     const newTodo = new Note({ text, user: req.user._id, note: noteId, DateTime });

//     await newTodo.save();

//     const note = await Note.findById(noteId);

//     if (!note) {
//       console.log("Note not found");
//       return res.status(404).send('Note not found');
//     }

//     // note.push(newTodo._id);

//     await note.save();

//     res.redirect(`/user/note/${noteId}`);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send('Internal Server Error');
//   }
// });
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

    //logging
    console.log('NoteId:', note._id)
    console.log('note:', JSON.stringify(note)) 
    console.log(note, "note");
    res.render('note/show.ejs', { req, note,  moment, NoteId: note._id});
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

// app.delete('/user/:id/todos/:todoId', ensureAuthenticated, async (req, res) => {
//   try {
//     const { todoId,id } = req.params;
//     console.log(id);
//     const deletedTodo = await Todo.findByIdAndDelete(todoId);
//     req.flash('success', 'Todo deleted successfully!');
//     res.redirect(`/user/note/${id}`);
//   } catch (error) {
//     console.error(error);
//     req.flash('error', 'Error deleting todo. Please try again.');
//     res.status(500).send('Internal Server Error');
//   }
// });

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
