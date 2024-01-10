const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: {
    type: String,
  },
  note: {
    type: String,
  },
});

const Note = mongoose.model('Note', noteSchema);

module.exports = Note;
