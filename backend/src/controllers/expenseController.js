const { prisma } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');

const mapActivityCategory = (category) => {
  const value = String(category || '').toLowerCase();
  const categories = [
    ['transportation', /\b(transport|transportation|transit|flight|train|bus|taxi)\b/],
    ['accommodation', /\b(accommodation|hotel|hostel|lodging|resort|stay)\b/],
    ['food', /\b(food|restaurant|meal|dining|cafe)\b/],
    ['shopping', /\b(shop|shopping|market)\b/],
    ['miscellaneous', /\b(misc|miscellaneous|other)\b/],
  ];
  const matches = categories.filter(([, pattern]) => pattern.test(value));
  return matches.length === 1 ? matches[0][0] : 'activities';
};

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

const getExpenses = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user.id },
    });
    if (!trip) return errorResponse(res, 'Trip not found or unauthorized', 404);

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      orderBy: { date: 'desc' },
    });

    return successResponse(res, { expenses });
  } catch (err) {
    next(err);
  }
};

const syncItineraryExpenses = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user.id },
      select: { id: true, currency: true, estimatedExpenses: true },
    });
    if (!trip) return errorResponse(res, 'Trip not found or unauthorized', 404);

    const planCosts = getPlanCostEntries(trip.estimatedExpenses);
    let expenses;

    if (planCosts.length > 0) {
      expenses = await prisma.$transaction(
        planCosts.map(({ category, amount, currency }) =>
          prisma.expense.upsert({
            where: { sourceKey: `plan:${tripId}:${category}` },
            create: {
              tripId,
              userId: req.user.id,
              sourceKey: `plan:${tripId}:${category}`,
              title: `AI plan: ${category}`,
              description: `Estimated ${category} cost from the AI trip plan`,
              category,
              amount,
              currency: currency || trip.currency,
              isEstimated: true,
            },
            update: {
              title: `AI plan: ${category}`,
              description: `Estimated ${category} cost from the AI trip plan`,
              category,
              amount,
              currency: currency || trip.currency,
              isEstimated: true,
            },
          })
        )
      );
    } else {
      const activities = await prisma.activity.findMany({
        where: {
          itineraryDay: { is: { tripId } },
          estimatedCost: { gt: 0 },
        },
        include: {
          itineraryDay: {
            select: { date: true },
          },
        },
      });

      expenses = await prisma.$transaction(
        activities.map((activity) =>
          prisma.expense.upsert({
            where: { sourceKey: `activity:${activity.id}` },
            create: {
              tripId,
              userId: req.user.id,
              sourceKey: `activity:${activity.id}`,
              title: activity.name,
              description: activity.description,
              category: mapActivityCategory(activity.category),
              amount: activity.estimatedCost,
              currency: activity.currency || trip.currency,
              date: activity.itineraryDay.date || new Date(),
              isEstimated: true,
            },
            update: {
              title: activity.name,
              description: activity.description,
              category: mapActivityCategory(activity.category),
              amount: activity.estimatedCost,
              currency: activity.currency || trip.currency,
              date: activity.itineraryDay.date || new Date(),
              isEstimated: true,
            },
          })
        )
      );
    }

    return successResponse(
      res,
      { syncedCount: expenses.length },
      'AI itinerary costs synced to the budget'
    );
  } catch (err) {
    next(err);
  }
};

const createExpense = async (req, res, next) => {
  try {
    const { tripId, category, title, description, amount, currency, date, isEstimated, receiptUrl } = req.body;

    if (!tripId || !title || amount == null || !category) {
      return errorResponse(res, 'tripId, category, title, and amount are required', 400);
    }

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user.id },
    });
    if (!trip) return errorResponse(res, 'Trip not found or unauthorized', 404);

    const expense = await prisma.expense.create({
      data: {
        tripId,
        userId: req.user.id,
        category,
        title,
        description,
        amount: parseFloat(amount),
        currency: currency || trip.currency || 'INR',
        date: date ? new Date(date) : new Date(),
        isEstimated: Boolean(isEstimated),
        receiptUrl,
      },
    });

    return successResponse(res, { expense }, 'Expense logged successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateExpense = async (req, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return errorResponse(res, 'Expense not found', 404);

    const { amount, date, ...rest } = req.body;
    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...rest,
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(date !== undefined && { date: date ? new Date(date) : null }),
      },
    });

    return successResponse(res, { expense: updated }, 'Expense updated');
  } catch (err) {
    next(err);
  }
};

const deleteExpense = async (req, res, next) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!existing) return errorResponse(res, 'Expense not found', 404);

    await prisma.expense.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Expense deleted');
  } catch (err) {
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const { tripId } = req.params;
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, userId: req.user.id },
    });
    if (!trip) return errorResponse(res, 'Trip not found', 404);

    const expenses = await prisma.expense.findMany({
      where: { tripId },
      orderBy: { date: 'asc' },
    });

    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const estimated = expenses.filter((e) => e.isEstimated).reduce((sum, e) => sum + e.amount, 0);
    const actual = expenses.filter((e) => !e.isEstimated).reduce((sum, e) => sum + e.amount, 0);

    const categoryMap = {};
    for (const exp of expenses) {
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    }

    const byCategory = Object.entries(categoryMap).map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
    }));

    // Daily spending grouping
    const dateMap = {};
    for (const exp of expenses) {
      const day = exp.date ? new Date(exp.date).toISOString().split('T')[0] : 'Undated';
      dateMap[day] = (dateMap[day] || 0) + exp.amount;
    }

    const dailySpending = Object.entries(dateMap)
      .map(([date, amount]) => ({
        date,
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalBudget = trip.budget || 0;
    const remainingBudget = totalBudget > 0 ? totalBudget - totalSpent : null;

    return successResponse(res, {
      tripId,
      currency: trip.currency,
      totalBudget,
      totalSpent: Math.round(totalSpent * 100) / 100,
      remainingBudget: remainingBudget != null ? Math.round(remainingBudget * 100) / 100 : null,
      estimatedSpent: Math.round(estimated * 100) / 100,
      actualSpent: Math.round(actual * 100) / 100,
      byCategory,
      dailySpending,
      expenseCount: expenses.length,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getExpenses,
  syncItineraryExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getAnalytics,
  mapActivityCategory,
  getPlanCostEntries,
};
