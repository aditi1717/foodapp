import jwt from 'jsonwebtoken';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const secret = process.env.JWT_ACCESS_SECRET || 'ndjdhjhdasdjdhasdjadaskdjasndaskdjadasndaskdjsndaskdjasdkasnddjkdndkjdnda';
const restaurantId = '69b805de9c070c51724618e6';

// Generate token
const token = jwt.sign(
  { userId: restaurantId, role: 'RESTAURANT' },
  secret,
  { expiresIn: '1h' }
);

const checkApi = async () => {
  try {
    const url = 'http://localhost:5000/api/v1/food/restaurant/orders?limit=10&page=1';
    console.log('Requesting URL:', url);
    const res = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Full API Response:');
    console.log(JSON.stringify(res.data, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error('API Error:', err.message);
    process.exit(1);
  }
};

checkApi();
