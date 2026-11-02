export const EntityTypes = {
  EVENT: 'event',
  REMINDER: 'reminder',
};

export const CalendarAccessLevel = {
  OWNER: 'owner',
  EDITOR: 'editor',
  CONTRIBUTOR: 'contributor',
  READ: 'read',
  FREEBUSY: 'freebusy',
  NONE: 'none',
};

export const getCalendarPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export const requestCalendarPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
});

export const getCalendarsAsync = jest.fn().mockResolvedValue([]);
export const createEventAsync = jest.fn().mockResolvedValue('mock_event_123');
export const getEventAsync = jest.fn().mockResolvedValue(null);
export const updateEventAsync = jest.fn().mockResolvedValue(undefined);
export const deleteEventAsync = jest.fn().mockResolvedValue(undefined);
export const getEventsAsync = jest.fn().mockResolvedValue([]);

