import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.MONGODB_URI;

console.log('Attempting to connect to MongoDB...');
if (!uri) {
    console.error('MONGODB_URI is not defined in .env');
    process.exit(1);
}
console.log('URI:', uri.replace(/:([^@]+)@/, ':****@')); // Hide password

mongoose.connect(uri)
  .then(() => {
    console.log('Successfully connected to MongoDB');
    process.exit(0);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
