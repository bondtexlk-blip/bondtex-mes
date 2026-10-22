/**
 * Factory Production Shifts & Time Slots Utility
 * Handles automatic shift detection (Day / Night) and hourly time slot detection based on plant schedule.
 */

// Day Shift: 07:45 to 21:30 (13 production slots)
export const DAY_SHIFT_SLOTS = [
  { id: '07:45-08:45', label: '07:45 - 08:45', display: '7.45 - 8.45 AM', startMin: 7 * 60 + 45, endMin: 8 * 60 + 45 },
  { id: '08:45-09:45', label: '08:45 - 09:45', display: '8.45 - 9.45 AM', startMin: 8 * 60 + 45, endMin: 9 * 60 + 45 },
  { id: '09:45-10:45', label: '09:45 - 10:45', display: '9.45 - 10.45 AM', startMin: 9 * 60 + 45, endMin: 10 * 60 + 45 },
  { id: '10:45-11:45', label: '10:45 - 11:45', display: '10.45 - 11.45 AM', startMin: 10 * 60 + 45, endMin: 11 * 60 + 45 },
  { id: '11:45-12:45', label: '11:45 - 12:45', display: '11.45 - 12.45 PM', startMin: 11 * 60 + 45, endMin: 12 * 60 + 45 },
  { id: '12:45-14:15', label: '12:45 - 14:15', display: '12.45 - 2.15 PM', startMin: 12 * 60 + 45, endMin: 14 * 60 + 15 },
  { id: '14:15-15:15', label: '14:15 - 15:15', display: '2.15 - 3.15 PM', startMin: 14 * 60 + 15, endMin: 15 * 60 + 15 },
  { id: '15:15-16:30', label: '15:15 - 16:30', display: '3.15 - 4.30 PM', startMin: 15 * 60 + 15, endMin: 16 * 60 + 30 },
  { id: '16:30-17:30', label: '16:30 - 17:30', display: '4.30 - 5.30 PM', startMin: 16 * 60 + 30, endMin: 17 * 60 + 30 },
  { id: '17:30-18:30', label: '17:30 - 18:30', display: '5.30 - 6.30 PM', startMin: 17 * 60 + 30, endMin: 18 * 60 + 30 },
  { id: '18:30-19:30', label: '18:30 - 19:30', display: '6.30 - 7.30 PM', startMin: 18 * 60 + 30, endMin: 19 * 60 + 30 },
  { id: '19:30-20:30', label: '19:30 - 20:30', display: '7.30 - 8.30 PM', startMin: 19 * 60 + 30, endMin: 20 * 60 + 30 },
  { id: '21:00-21:30', label: '21:00 - 21:30', display: '9.00 - 9.30 PM', startMin: 21 * 60, endMin: 21 * 60 + 30 },
];

// Night Shift: 21:30 to 07:30 (10 hourly slots)
export const NIGHT_SHIFT_SLOTS = [
  { id: '21:30-22:30', label: '21:30 - 22:30', display: '9.30 - 10.30 PM', startMin: 21 * 60 + 30, endMin: 22 * 60 + 30 },
  { id: '22:30-23:30', label: '22:30 - 23:30', display: '10.30 - 11.30 PM', startMin: 22 * 60 + 30, endMin: 23 * 60 + 30 },
  { id: '23:30-00:30', label: '23:30 - 00:30', display: '11.30 - 12.30 AM', startMin: 23 * 60 + 30, endMin: 24 * 60 + 30 },
  { id: '00:30-01:30', label: '00:30 - 01:30', display: '12.30 - 1.30 AM', startMin: 30, endMin: 1 * 60 + 30 },
  { id: '01:30-02:30', label: '01:30 - 02:30', display: '1.30 - 2.30 AM', startMin: 1 * 60 + 30, endMin: 2 * 60 + 30 },
  { id: '02:30-03:30', label: '02:30 - 03:30', display: '2.30 - 3.30 AM', startMin: 2 * 60 + 30, endMin: 3 * 60 + 30 },
  { id: '03:30-04:30', label: '03:30 - 04:30', display: '3.30 - 4.30 AM', startMin: 3 * 60 + 30, endMin: 4 * 60 + 30 },
  { id: '04:30-05:30', label: '04:30 - 05:30', display: '4.30 - 5.30 AM', startMin: 4 * 60 + 30, endMin: 5 * 60 + 30 },
  { id: '05:30-06:30', label: '05:30 - 06:30', display: '5.30 - 6.30 AM', startMin: 5 * 60 + 30, endMin: 6 * 60 + 30 },
  { id: '06:30-07:30', label: '06:30 - 07:30', display: '6.30 - 7.30 AM', startMin: 6 * 60 + 30, endMin: 7 * 60 + 30 },
];

/**
 * Detect shift name ('Day Shift' | 'Night Shift') based on current clock time
 */
export function detectCurrentShift(date = new Date()) {
  const mins = date.getHours() * 60 + date.getMinutes();
  // Day shift runs 07:45 (465 mins) to 21:30 (1290 mins)
  if (mins >= 465 && mins < 1290) {
    return 'Day Shift';
  }
  return 'Night Shift';
}

/**
 * Automatically detect current active hourly time slot
 */
export function detectCurrentTimeSlot(date = new Date(), shift) {
  const currentShift = shift || detectCurrentShift(date);
  const mins = date.getHours() * 60 + date.getMinutes();

  if (currentShift === 'Day Shift') {
    // Before first day slot
    if (mins < DAY_SHIFT_SLOTS[0].startMin) {
      return DAY_SHIFT_SLOTS[0].label;
    }
    // Check in slots
    for (const slot of DAY_SHIFT_SLOTS) {
      if (mins >= slot.startMin && mins < slot.endMin) {
        return slot.label;
      }
    }
    // Break between 20:30 and 21:00
    if (mins >= 20 * 60 + 30 && mins < 21 * 60) {
      return '19:30 - 20:30';
    }
    // Late in day shift
    return DAY_SHIFT_SLOTS[DAY_SHIFT_SLOTS.length - 1].label;
  } else {
    // Night Shift
    // Check slots before midnight (21:30 to 24:00)
    if (mins >= 21 * 60 + 30) {
      for (const slot of NIGHT_SHIFT_SLOTS) {
        if (slot.startMin >= 21 * 60 && mins >= slot.startMin && mins < slot.endMin) {
          return slot.label;
        }
      }
    }
    // Check slots after midnight (00:00 to 07:30)
    if (mins < 7 * 60 + 30) {
      // 00:00 to 00:30 falls into 23:30 - 00:30
      if (mins < 30) {
        return '23:30 - 00:30';
      }
      for (const slot of NIGHT_SHIFT_SLOTS) {
        if (slot.startMin < 20 * 60 && mins >= slot.startMin && mins < slot.endMin) {
          return slot.label;
        }
      }
    }
    // Fallback night slot
    return NIGHT_SHIFT_SLOTS[0].label;
  }
}

/**
 * Get all available slots for a given shift
 */
export function getSlotsForShift(shift) {
  return shift === 'Night Shift' ? NIGHT_SHIFT_SLOTS : DAY_SHIFT_SLOTS;
}
