const { generateItineraryPlan, aiTravelChat } = require('../services/aiService');
const { prisma } = require('../config/database');
const { successResponse, errorResponse } = require('../utils/response');
const { v4: uuidv4 } = require('uuid');
const { getPlanCostEntries } = require('../utils/planExpenses');

const generateItinerary = async (req, res, next) => {
  try {
    const preferences = req.body;

    if (!preferences.startLocation || !preferences.destinations) {
      return errorResponse(res, 'startLocation and destinations are required for itinerary generation', 400);
    }

    const plan = await generateItineraryPlan(preferences);
    return successResponse(res, { plan }, 'AI itinerary generated successfully');
  } catch (err) {
    if (err.message && err.message.startsWith('MISSING_API_KEY')) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: err.message,
        tip: 'To enable AI generation, add GEMINI_API_KEY to backend/.env',
      });
    }
    next(err);
  }
};

const saveGeneratedItinerary = async (req, res, next) => {
  try {
    const { title, plan, currency = 'INR' } = req.body;

    if (!plan || !plan.days) {
      return errorResponse(res, 'Valid generated plan object is required', 400);
    }

    const tripId = uuidv4();
    const planCosts = getPlanCostEntries(plan.estimatedExpenses);
    const trip = await prisma.trip.create({
      data: {
        id: tripId,
        userId: req.user.id,
        title: title || `${plan.destinations?.[0] || 'AI Planned'} Expedition`,
        description: plan.tripOverview,
        startLocation: plan.destinations?.[0] || 'Origin',
        destinations: plan.destinations || [],
        currency: plan.estimatedExpenses?.currency || currency,
        budget: plan.estimatedExpenses?.totalEstimated || null,
        estimatedExpenses: plan.estimatedExpenses || null,
        status: 'planning',
        expenses: {
          create: planCosts.map(({ category, amount, currency: planCurrency }) => ({
            userId: req.user.id,
            sourceKey: `plan:${tripId}:${category}`,
            category,
            title: `AI plan: ${category}`,
            description: `Estimated ${category} cost from the AI trip plan`,
            amount,
            currency: planCurrency || plan.estimatedExpenses?.currency || currency,
            isEstimated: true,
          })),
        },
        itineraryDays: {
          create: plan.days.map((day) => {
            const allActivities = [
              ...(day.morning || []).map((a, i) => ({ ...a, orderIndex: i })),
              ...(day.afternoon || []).map((a, i) => ({ ...a, orderIndex: 10 + i })),
              ...(day.evening || []).map((a, i) => ({ ...a, orderIndex: 20 + i })),
            ];

            return {
              dayNumber: day.dayNumber,
              location: day.location,
              summary: day.summary,
              weatherNote: day.weatherNote,
              activities: {
                create: allActivities.map((act) => ({
                  name: act.name,
                  description: act.description,
                  timeOfDay: act.timeOfDay,
                  startTime: act.startTime,
                  endTime: act.endTime,
                  estimatedCost: act.estimatedCost,
                  currency: act.currency || currency,
                  category: act.category,
                  location: act.location,
                  latitude: act.latitude,
                  longitude: act.longitude,
                  notes: act.notes,
                  orderIndex: act.orderIndex,
                })),
              },
            };
          }),
        },
      },
      include: {
        itineraryDays: {
          include: { activities: true },
        },
      },
    });

    // Populate initial graph nodes from activities with coordinates
    const createdNodes = [];
    for (const day of trip.itineraryDays) {
      for (const act of day.activities) {
        if (act.latitude && act.longitude) {
          const node = await prisma.graphNode.create({
            data: {
              tripId: trip.id,
              name: act.name,
              nodeType: 'attraction',
              latitude: act.latitude,
              longitude: act.longitude,
              description: act.description,
            },
          });
          createdNodes.push(node);
        }
      }
    }

    // Connect sequential nodes in the graph
    for (let i = 0; i < createdNodes.length - 1; i++) {
      await prisma.graphEdge.create({
        data: {
          tripId: trip.id,
          sourceId: createdNodes[i].id,
          targetId: createdNodes[i + 1].id,
          edgeType: 'recommended',
          transportMode: 'Transit',
        },
      });
    }

    return successResponse(res, { trip }, 'Generated itinerary saved to your trips', 201);
  } catch (err) {
    next(err);
  }
};

const chat = async (req, res, next) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return errorResponse(res, 'messages array is required', 400);
    }

    const reply = await aiTravelChat(messages, context);
    return successResponse(res, { reply });
  } catch (err) {
    if (err.message && err.message.startsWith('MISSING_API_KEY')) {
      return res.status(503).json({
        success: false,
        configured: false,
        message: 'Gemini API key is not configured.',
      });
    }
    next(err);
  }
};

module.exports = {
  generateItinerary,
  saveGeneratedItinerary,
  chat,
};
