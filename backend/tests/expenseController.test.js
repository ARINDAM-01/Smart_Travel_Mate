const {
  getBudgetCategoryData,
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

  test('uses itinerary estimates for the breakdown when no expenses are recorded', () => {
    expect(getBudgetCategoryData([], {
      transportation: 70,
      food: 30,
      totalEstimated: 100,
      currency: 'INR',
    })).toEqual({
      byCategory: [
        { category: 'transportation', amount: 70, percentage: 70 },
        { category: 'food', amount: 30, percentage: 30 },
      ],
      byCategorySource: 'planned',
    });
  });

  test('uses recorded expenses instead of plan estimates when available', () => {
    expect(getBudgetCategoryData([
      { category: 'food', amount: 20 },
    ], { transportation: 70 })).toEqual({
      byCategory: [{ category: 'food', amount: 20, percentage: 100 }],
      byCategorySource: 'expenses',
    });
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
