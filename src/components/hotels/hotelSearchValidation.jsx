import { isAfter, isBefore, isValid, parseISO, startOfDay } from 'date-fns';

export function isValidDateValue(value) {
  if (!value) return false;
  const date = parseISO(value);
  return isValid(date);
}

export function hasPickedDestination(destination) {
  if (!destination || typeof destination !== 'object') return false;
  const isHotel = destination.type === 'HOTEL' || destination.regionType === 'HOTEL';
  if (isHotel) return Boolean(destination.hotelId);
  return Boolean(destination.cityRegionId || destination.regionId);
}

export function hasValidListingDestination({
  destinationType = 'CITY',
  cityRegionId = '',
  hotelId = '',
} = {}) {
  const isHotel = String(destinationType).toUpperCase() === 'HOTEL';
  const id = isHotel ? String(hotelId || '').trim() : String(cityRegionId || '').trim();
  return /^\d+$/.test(id) && Number(id) > 0;
}

export function validateHotelSearchFields({
  destinationName = '',
  hasValidDestinationId = false,
  checkin = '',
  checkout = '',
  rooms = [],
  skipDestination = false,
}) {
  const errors = {};
  const destination = String(destinationName || '').trim();

  if (!skipDestination) {
    if (!destination) {
      errors.destination = 'Please enter a city, area or hotel name.';
    } else if (!hasValidDestinationId) {
      errors.destination = 'Please select a city or hotel from the suggestions list.';
    }
  }

  if (!checkin || !isValidDateValue(checkin)) {
    errors.checkin = 'Please select a valid check-in date.';
  } else if (isBefore(startOfDay(parseISO(checkin)), startOfDay(new Date()))) {
    errors.checkin = 'Check-in date cannot be in the past.';
  }

  if (!checkout || !isValidDateValue(checkout)) {
    errors.checkout = 'Please select a valid check-out date.';
  } else if (isBefore(startOfDay(parseISO(checkout)), startOfDay(new Date()))) {
    errors.checkout = 'Check-out date cannot be in the past.';
  } else if (checkin && isValidDateValue(checkin) && isValidDateValue(checkout)) {
    if (!isAfter(parseISO(checkout), parseISO(checkin))) {
      errors.checkout = 'Check-out must be after check-in.';
    }
  }

  const safeRooms = Array.isArray(rooms) ? rooms : [];
  if (!safeRooms.length) {
    errors.rooms = 'Please add at least one room.';
  } else if (safeRooms.some((room) => Number(room?.adults || 0) < 1)) {
    errors.rooms = 'Each room must have at least 1 adult.';
  }

  return errors;
}

export function hasValidationErrors(errors) {
  return Object.keys(errors || {}).length > 0;
}

export function SearchFieldError({ message }) {
  if (!message) return null;
  return <p className="text-xs text-red-600 mt-1 px-1">{message}</p>;
}
