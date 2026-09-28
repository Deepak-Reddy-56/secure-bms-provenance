const {
  listUsers,
  addUser,
  findUserById,
  updateUserRole,
  setUserActive,
  removeUser,
} = require('./userStore');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

function getUsers() {
  return listUsers();
}

function createUser({ email, name, role }) {
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

function changeUserRole(id, role) {
  return updateUserRole(id, role);
}

function changeUserStatus(id, active) {
  return setUserActive(id, active);
}

function deleteUser(id) {
  return removeUser(id);
}

function getUser(id) {
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
