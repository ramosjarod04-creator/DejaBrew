// usermanagement.js

let users = JSON.parse(localStorage.getItem("users")) || [
  { name: "Admin", email: "admin@dejabrew.com", role: "Admin", displayName: "Owner", status: "Active", created: "2024-01-01" },
  { name: "Cashier 1", email: "cashier1@dejabrew.com", role: "Cashier", displayName: "John Doe", status: "Active", created: "2024-01-05" },
  { name: "Cashier 2", email: "cashier2@dejabrew.com", role: "Cashier", displayName: "Jane Doe", status: "Active", created: "2024-01-10" }
];

const tableBody = document.querySelector("#userTable tbody");
const totalUsers = document.getElementById("totalUsers");
const activeUsers = document.getElementById("activeUsers");
const adminUsers = document.getElementById("adminUsers");
const cashierUsers = document.getElementById("cashierUsers");

function renderUsers() {
  tableBody.innerHTML = "";
  users.forEach((u, i) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><div class="avatar sm">${u.name.split(" ")[0][0]}</div> ${u.name}</td>
      <td>${u.email}</td>
      <td><span class="badge ${u.role}">${u.role}</span></td>
      <td>${u.displayName}</td>
      <td><span class="status ${u.status}">${u.status}</span></td>
      <td>${u.created}</td>
      <td>
        <i class="fa fa-edit action" onclick="editUser(${i})"></i>
        <i class="fa fa-trash action delete" onclick="deleteUser(${i})"></i>
      </td>`;
    tableBody.appendChild(row);
  });
  updateStats();
  localStorage.setItem("users", JSON.stringify(users));
}

function updateStats() {
  totalUsers.textContent = users.length;
  activeUsers.textContent = users.filter(u => u.status === "Active").length;
  adminUsers.textContent = users.filter(u => u.role === "Admin").length;
  cashierUsers.textContent = users.filter(u => u.role === "Cashier").length;
}

// Filters
document.getElementById("searchInput").addEventListener("input", filterUsers);
document.getElementById("roleFilter").addEventListener("change", filterUsers);
document.getElementById("statusFilter").addEventListener("change", filterUsers);

function filterUsers() {
  const searchVal = document.getElementById("searchInput").value.toLowerCase();
  const roleVal = document.getElementById("roleFilter").value;
  const statusVal = document.getElementById("statusFilter").value;

  tableBody.innerHTML = "";
  users
    .filter(u =>
      (u.name.toLowerCase().includes(searchVal) ||
       u.email.toLowerCase().includes(searchVal) ||
       u.displayName.toLowerCase().includes(searchVal)) &&
      (roleVal === "all" || u.role === roleVal) &&
      (statusVal === "all" || u.status === statusVal)
    )
    .forEach((u, i) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><div class="avatar sm">${u.name[0]}</div> ${u.name}</td>
        <td>${u.email}</td>
        <td><span class="badge ${u.role}">${u.role}</span></td>
        <td>${u.displayName}</td>
        <td><span class="status ${u.status}">${u.status}</span></td>
        <td>${u.created}</td>
        <td>
          <i class="fa fa-edit action" onclick="editUser(${i})"></i>
          <i class="fa fa-trash action delete" onclick="deleteUser(${i})"></i>
        </td>`;
      tableBody.appendChild(row);
    });
}

// Modal
const modal = document.getElementById("userModal");
const closeBtn = document.querySelector(".close");
const addUserBtn = document.getElementById("addUserBtn");
const userForm = document.getElementById("userForm");
const modalTitle = document.getElementById("modalTitle");

addUserBtn.onclick = () => {
  modal.style.display = "flex";
  modalTitle.textContent = "Add User";
  userForm.reset();
  document.getElementById("editIndex").value = "";
};
closeBtn.onclick = () => modal.style.display = "none";
window.onclick = e => { if (e.target === modal) modal.style.display = "none"; };

userForm.onsubmit = e => {
  e.preventDefault();
  const index = document.getElementById("editIndex").value;
  const newUser = {
    name: document.getElementById("name").value,
    email: document.getElementById("email").value,
    role: document.getElementById("role").value,
    displayName: document.getElementById("name").value,
    status: document.getElementById("status").value,
    created: new Date().toISOString().split("T")[0]
  };
  if (index) {
    users[index] = newUser;
  } else {
    users.push(newUser);
  }
  renderUsers();
  modal.style.display = "none";
};

function editUser(index) {
  modal.style.display = "flex";
  modalTitle.textContent = "Edit User";
  document.getElementById("editIndex").value = index;
  document.getElementById("name").value = users[index].name;
  document.getElementById("email").value = users[index].email;
  document.getElementById("role").value = users[index].role;
  document.getElementById("status").value = users[index].status;
}

function deleteUser(index) {
  if (confirm("Are you sure you want to delete this user?")) {
    users.splice(index, 1);
    renderUsers();
  }
}

// Init
renderUsers();
