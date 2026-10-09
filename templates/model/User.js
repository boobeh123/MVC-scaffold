const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const BCRYPT_COST = 12;

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxLength: 254,
    },
    password: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Hash the password whenever it's new or changed, so plain text is never stored
UserSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, BCRYPT_COST);
});

module.exports = mongoose.model('User', UserSchema);
