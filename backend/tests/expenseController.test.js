const {
  getCategoryBreakdown,
  mapActivityCategory,
} = require('../src/controllers/expenseController');
const { getPlanCostEntries } = require('../src/utils/planExpenses');

describe('AI itinerary expense categories', () => {
  test.each([
    ['transport', 'transportation'],
    ['train transfer', 'transportation'],
    ['hotel', 'accommodation'],
    ['food', 'food'],
    ['local market shopping', 'shopping'],
    ['museum', 'activities'],
    ['food / transport', 'activities'],
  ])('maps "%s" to %s', (activityCategory, expectedCategory) => {
    expect(mapActivityCategory(activityCategory)).toBe(expectedCategory);
  });
});

describe('Budget category ranking', () => {
  test('sorts category totals from highest to lowest spend', () => {
    expect(getCategoryBreakdown({ food: 12.5, transportation: 90, activities: 30 }, 132.5))
      .toEqual([
        { category: 'transportation', amount: 90, percentage: 68 },
        { category: 'activities', amount: 30, percentage: 23 },
        { category: 'food', amount: 12.5, percentage: 9 },
      ]);
  });
});

describe('AI plan budget entries', () => {
  test('keeps positive category totals and the plan currency', () => {
    expect(getPlanCostEntries({
      transportation: 120,
      accommodation: 0,
      food: 45.5,
      activities: 20,
      miscellaneous: -1,
      totalEstimated: 185.5,
      currency: 'EUR',
    })).toEqual([
      { category: 'transportation', amount: 120, currency: 'EUR' },
      { category: 'food', amount: 45.5, currency: 'EUR' },
      { category: 'activities', amount: 20, currency: 'EUR' },
    ]);
  });

  test('returns no summary entries when no positive category totals exist', () => {
    expect(getPlanCostEntries({ transportation: 0, currency: 'USD' })).toEqual([]);
  });
});
