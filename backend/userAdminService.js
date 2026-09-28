const {
  listUsers,
  addUser,
  findUserById,
  updateUserRole,
  setUserActive,
  removeUser,
} = require('./userStore');

function getUsers() {
  return listUsers();
}

function createUser({ email, name, role }) {
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