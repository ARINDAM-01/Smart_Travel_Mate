const getPlanCostEntries = (estimatedExpenses) => {
  if (!estimatedExpenses || typeof estimatedExpenses !== 'object') return [];
  return ['transportation', 'accommodation', 'food', 'activities', 'miscellaneous']
    .map((category) => ({
      category,
      amount: Number(estimatedExpenses[category]),
      currency: estimatedExpenses.currency,
    }))
    .filter((entry) => Number.isFinite(entry.amount) && entry.amount > 0);
};

module.exports = { getPlanCostEntries };
