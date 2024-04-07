const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  StartTime: Date,
  EndTime: Date,
  title: {
    type: String,
  },
  completed: {
    type:Boolean,
    default: false
  },
  note: {
    type: String,
  },
});

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;