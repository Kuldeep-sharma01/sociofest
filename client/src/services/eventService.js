// client/src/services/eventService.js
import { apiClient, toFormData, appendFiles } from "@/services/apiClient";

const API_BASE = "/events";

// API client already normalizes response envelopes.
const extract = (res) => res.data;

/**
 * Fetch all events
 * @returns {Promise<Array>} List of events
 */
export const getAllEvents = async () => {
  const data = extract(await apiClient.get(API_BASE));
  return Array.isArray(data) ? data : data?.events || [];
};

/**
 * Fetch a specific event by ID
 * @param {String} eventId - Unique event ID
 * @returns {Promise<Object>} Event details
 */
export const getEventById = async (eventId) => {
  return extract(await apiClient.get(`${API_BASE}/${eventId}`));
};

/**
 * Create a new event (Admin/Teacher)
 * @param {Object} eventData - Event title, start, end, description, etc.
 * @returns {Promise<Object>} Newly created event
 */
export const createEvent = async (eventData, attachments = []) => {
  if (attachments.length > 0) {
    const formData = toFormData(eventData);
    appendFiles(formData, attachments, "files");
    return extract(await apiClient.post(API_BASE, formData));
  }

  return extract(await apiClient.post(API_BASE, eventData));
};

/**
 * Update an existing event (Admin/Teacher)
 * @param {String} eventId - Event ID
 * @param {Object} updatedData - Updated event fields
 * @returns {Promise<Object>} Updated event
 */
export const updateEvent = async (eventId, updatedData, attachments = [], retainedMediaIds = []) => {
  const payload = { ...updatedData, retainedMediaIds };
  const formData = toFormData(payload);
  if (attachments.length > 0) appendFiles(formData, attachments, "files");
  return extract(await apiClient.put(`${API_BASE}/${eventId}`, formData));
};

/**
 * Delete an event (Admin only)
 * @param {String} eventId - Event ID
 * @returns {Promise<Object>} Confirmation message
 */
export const deleteEvent = async (eventId) => {
  return extract(await apiClient.delete(`${API_BASE}/${eventId}`));
};
