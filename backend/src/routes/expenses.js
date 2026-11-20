const express = require('express');
const router = express.Router();
const {
  getExpenses,
  syncItineraryExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} = require('../controllers/expenseController');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

router.post('/:tripId/sync-itinerary', syncItineraryExpenses);
router.get('/:tripId', getExpenses);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
