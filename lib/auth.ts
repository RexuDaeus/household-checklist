// Simple client-side auth helper functions

interface User {
  username: string;
  password: string;
}

export function registerUser(username: string, password: string): boolean {
  const users = getUsersFromStorage();
  
  // Check if username already exists
  if (users.some(user => user.username === username)) {
    return false;
  }
  
  // Add new user
  users.push({ username, password });
  localStorage.setItem('users', JSON.stringify(users));
  return true;
}

export function loginUser(username: string, password: string): boolean {
  const users = getUsersFromStorage();
  
  // Find user and validate password
  const user = users.find(user => user.username === username && user.password === password);
  
  if (user) {
    setUserCookie(username);
    return true;
  }
  
  return false;
}

function getUsersFromStorage(): User[] {
  const usersJson = localStorage.getItem('users');
  return usersJson ? JSON.parse(usersJson) : [];
}

export function setUserCookie(username: string) {
  // Set cookie with path and expiration (24 hours)
  document.cookie = `user=${username}; path=/; max-age=86400`;
}

export function getUserFromCookie(): string | null {
  const cookies = document.cookie.split(";");
  const userCookie = cookies.find((cookie) => cookie.trim().startsWith("user="));

  if (userCookie) {
    return userCookie.trim().split("=")[1];
  }

  return null;
}

export function clearUserCookie() {
  document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
}