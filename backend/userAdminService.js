'use strict';

const {
  listUsers,
  addUser,
  findUserById,
  updateUserRole,
  setUserActive,
  removeUser,
} = require('./userStore');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

async function getUsers() {
  return listUsers();
}

async function createUser({ email, name, role }) {
  if (
    ADMIN_EMAIL &&
    typeof email === 'string' &&
    email.trim().toLowerCase() === ADMIN_EMAIL
  ) {
    throw new Error('Admin account cannot be assigned an operational role.');
  }

  return addUser({
    email,
    name,
    role,
  });
}

async function changeUserRole(id, role) {
  return updateUserRole(id, role);
}

async function changeUserStatus(id, active) {
  return setUserActive(id, active);
}

async function deleteUser(id) {
  return removeUser(id);
}

async function getUser(id) {
  return findUserById(id);
}

module.exports = {
  getUsers,
  createUser,
  getUser,
  changeUserRole,
  changeUserStatus,
  deleteUser,
};
