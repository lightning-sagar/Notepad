const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  googleId: String,
  username: String,
});

userSchema.plugin(passportLocalMongoose);

userSchema.statics.findByGoogleId = function (googleId) {
  return this.findOne({ googleId }).exec();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
