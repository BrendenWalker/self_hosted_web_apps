import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export default api;

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((r) => r.data);

export const logout = () => api.post('/auth/logout').then((r) => r.data);

export const signup = (email, password) =>
  api.post('/auth/signup', { email, password }).then((r) => r.data);

export const fetchMe = () => api.get('/auth/me').then((r) => r.data);

export const fetchDashboard = () => api.get('/dashboard').then((r) => r.data);

export const postActivity = (payload) => api.post('/activity', payload).then((r) => r.data);

export const deleteActivity = (id) => api.delete(`/activities/${id}`).then((r) => r.data);

export const fetchActivities = (params) =>
  api.get('/activities', { params }).then((r) => r.data);

export const fetchLatestByType = (petId) =>
  api.get('/latest_by_type', { params: { pet_id: petId } }).then((r) => r.data);

export const fetchSpeedometer = (petId) =>
  api.get('/summary/potty_speedometer', { params: { pet_id: petId } }).then((r) => r.data);

export const fetchDailyCounts = (params) =>
  api.get('/summary/daily_counts', { params }).then((r) => r.data);

export const fetchPottyHold = (params) =>
  api.get('/summary/potty_hold_time', { params }).then((r) => r.data);

export const fetchPottyLocation = (params) =>
  api.get('/summary/potty_location', { params }).then((r) => r.data);

export const fetchPets = () => api.get('/pets').then((r) => r.data);

export const createPet = (name) => api.post('/pets', { name }).then((r) => r.data);

export const updatePetBirthdate = (petId, birthdate) =>
  api.post(`/pets/${petId}/update`, { birthdate }).then((r) => r.data);

export const updatePetFoodTransition = (petId, { adult_food_transition_start, daily_food_cups }) =>
  api
    .post(`/pets/${petId}/update`, { adult_food_transition_start, daily_food_cups })
    .then((r) => r.data);

export const getDefaultPet = () => api.get('/users/default_pet').then((r) => r.data);

export const setDefaultPet = (petId) =>
  api.post('/users/default_pet', { pet_id: petId }).then((r) => r.data);

export const fetchPetsManage = () => api.get('/pets/manage').then((r) => r.data);

export const addPetMember = (petId, email) =>
  api.post(`/pets/${petId}/add_user`, { email }).then((r) => r.data);

export const removePetMember = (petId, userId) =>
  api.post(`/pets/${petId}/remove_user`, { user_id: userId }).then((r) => r.data);

export const invitePetMember = (petId, email) =>
  api.post(`/pets/${petId}/invite`, { email }).then((r) => r.data);

export const revokeInvite = (petId, invId) =>
  api.post(`/pets/${petId}/invites/${invId}/revoke`).then((r) => r.data);

export const deletePet = (petId) => api.post(`/pets/${petId}/delete`).then((r) => r.data);

export const fetchInvitePreview = (token) =>
  api.get(`/invite/pet/${token}`).then((r) => r.data);

export const acceptInvite = (token) =>
  api.post(`/invite/pet/${token}/accept`).then((r) => r.data);

export const fetchAdminOverview = () => api.get('/admin/overview').then((r) => r.data);

export const updateAdminUser = (userId, body) =>
  api.post(`/admin/users/${userId}`, body).then((r) => r.data);

export const updateAdminSettings = (body) =>
  api.post('/admin/settings', body).then((r) => r.data);

export const testAdminEmail = (to) =>
  api.post('/admin/test_email', { to }).then((r) => r.data);

export const recalcTrend = () => api.post('/admin/recalc_trend').then((r) => r.data);

export const fetchReportJson = (params) =>
  api.get('/report', { params }).then((r) => r.data);
