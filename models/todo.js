const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const todoSchema = new Schema({
    text: String,
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
});

const Todo = mongoose.model('Todo', todoSchema);
module.exports = Todo;
