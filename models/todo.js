const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  text: String,
  dateTime: new Date(dateTime),
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  
    required: true
  },
  note: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note'  
  },
  completed: Boolean,
});

const Todo = mongoose.model('Todo', todoSchema);

module.exports = Todo;
