import axios from 'axios';
const createApiInstance = () => {
 const token = localStorage.getItem('authToken');
 const instance = axios.create({
 baseURL: window.location.origin,
 headers: {
 'Authorization': token ? `Bearer ${token}` : '',
 'Content-Type': 'application/json'
 },
 timeout: 30000
 });
 instance.interceptors.response.use((response) => {
 return response;
 }, (error) => {
 if (error.response?.status === 401) {
 localStorage.removeItem('authToken');
 window.location.href = '/login';
 }
 return Promise.reject(error);
 });
 return instance;
};
export const api = createApiInstance();
export const refreshApiInstance = () => {
 return createApiInstance();
};
export const getToken = () => {
 return localStorage.getItem('authToken');
};
export const setToken = (token) => {
 localStorage.setItem('authToken', token);
};
export const removeToken = () => {
 localStorage.removeItem('authToken');
};