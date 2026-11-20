import { jsPDF } from 'jspdf';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const safeFilename = (value) => {
  const filename = String(value || 'trip')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return filename || 'trip';
};

export const createTripPdf = (trip) => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const bottomMargin = 18;
  let y = 18;

  const addText = (
    value,
    {
      fontSize = 10,
      fontStyle = 'normal',
      color = [55, 65, 81],
      indent = 0,
      after = 4,
    } = {}
  ) => {
    if (value === null || value === undefined || value === '') return;
    pdf.setFont('helvetica', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(String(value), contentWidth - indent);
    const lineHeight = fontSize * 0.48;
    let lineIndex = 0;
    while (lineIndex < lines.length) {
      let linesPerPage = Math.floor((pageHeight - bottomMargin - y) / lineHeight);
      if (linesPerPage < 1) {
        pdf.addPage();
        y = 18;
        linesPerPage = Math.floor((pageHeight - bottomMargin - y) / lineHeight);
      }

      const pageLines = lines.slice(lineIndex, lineIndex + linesPerPage);
      pdf.text(pageLines, margin + indent, y);
      y += pageLines.length * lineHeight;
      lineIndex += pageLines.length;

      if (lineIndex < lines.length) {
        pdf.addPage();
        y = 18;
      }
    }

    y += after;
  };

  addText(trip.title || 'Travel Itinerary', {
    fontSize: 22,
    fontStyle: 'bold',
    color: [15, 23, 42],
    after: 3,
  });
  addText(trip.description, { fontSize: 11, color: [75, 85, 99], after: 7 });

  const travelDates = [formatDate(trip.startDate), formatDate(trip.endDate)].filter(Boolean);
  if (travelDates.length) {
    addText(`Travel dates: ${travelDates.join(' - ')}`, { fontStyle: 'bold' });
  }
  addText(`Status: ${trip.status || 'planning'}`);
  addText(`Starting location: ${trip.startLocation || 'Not specified'}`);
  addText(
    `Destinations: ${Array.isArray(trip.destinations) && trip.destinations.length
      ? trip.destinations.join(', ')
      : 'Not specified'}`
  );
  addText(`Travelers: ${trip.numTravelers || 1}`);
  addText(
    `Budget: ${trip.budget !== null && trip.budget !== undefined
      ? `${trip.currency || 'USD'} ${trip.budget}`
      : 'Flexible'}`,
    { after: 8 }
  );

  addText('Day-by-Day Itinerary', {
    fontSize: 15,
    fontStyle: 'bold',
    color: [8, 145, 178],
    after: 6,
  });

  const days = [...(trip.itineraryDays || [])].sort((a, b) => a.dayNumber - b.dayNumber);
  if (!days.length) {
    addText('No itinerary days have been scheduled for this trip.', {
      fontStyle: 'italic',
      color: [107, 114, 128],
    });
  }

  days.forEach((day) => {
    addText(`Day ${day.dayNumber}${day.location ? `: ${day.location}` : ''}`, {
      fontSize: 13,
      fontStyle: 'bold',
      color: [30, 64, 175],
      after: 2,
    });
    const dayDate = formatDate(day.date);
    if (dayDate) addText(`Date: ${dayDate}`, { fontSize: 9, after: 2 });
    if (day.summary) addText(day.summary, { fontSize: 10, after: 2 });
    if (day.weatherNote) {
      addText(`Weather: ${day.weatherNote}`, { fontSize: 9, color: [107, 114, 128], after: 3 });
    }

    const activities = Array.isArray(day.activities) ? day.activities : [];
    if (!activities.length) {
      addText('No activities scheduled.', {
        fontSize: 9,
        fontStyle: 'italic',
        indent: 3,
      });
    }

    activities.forEach((activity) => {
      const timeOfDay = activity.timeOfDay
        ? `${activity.timeOfDay.charAt(0).toUpperCase()}${activity.timeOfDay.slice(1)}: `
        : '';
      addText(`${timeOfDay}${activity.name || 'Activity'}`, {
        fontSize: 10,
        fontStyle: 'bold',
        indent: 3,
        after: 1,
      });
      if (activity.description) {
        addText(activity.description, { fontSize: 9, indent: 6, after: 1 });
      }
      if (activity.location) {
        addText(`Location: ${activity.location}`, { fontSize: 9, indent: 6, after: 1 });
      }
      if (activity.notes) {
        addText(`Tip: ${activity.notes}`, { fontSize: 9, indent: 6, after: 1 });
      }
      if (activity.estimatedCost > 0) {
        addText(
          `Estimated cost: ${activity.currency || trip.currency || 'USD'} ${activity.estimatedCost}`,
          { fontSize: 9, indent: 6, after: 3 }
        );
      } else {
        y += 2;
      }
    });

    y += 4;
  });

  const pageCount = pdf.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text('TravelMate', margin, pageHeight - 8);
    pdf.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    });
  }

  return pdf;
};

export const exportTripPdf = (trip) => {
  const pdf = createTripPdf(trip);
  pdf.save(`${safeFilename(trip.title)}-itinerary.pdf`);
};
