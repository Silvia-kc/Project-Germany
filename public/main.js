// ------------------------
// DOM Elements
// ------------------------
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("registration-form");
const showRegisterLink = document.getElementById("show-register");
const showLoginLink = document.getElementById("show-login");

const roleDisplay = document.getElementById("role-display");
const buyerDashboard = document.getElementById("buyer-dashboard");
const sellerDashboard = document.getElementById("seller-dashboard");

const brandSelect = document.getElementById("brand");
const modelSelect = document.getElementById("model");
const infoDiv = document.getElementById("info");
const socket = io();

let carsData = {};
let userRole = null;
let userName = null;

// ------------------------
// Form switching
// ------------------------
showRegisterLink.addEventListener("click", (e) => {
  e.preventDefault();
  registerForm.style.display = "block";
  loginForm.style.display = "none";
});

showLoginLink.addEventListener("click", (e) => {
  e.preventDefault();
  loginForm.style.display = "block";
  registerForm.style.display = "none";
});

// ------------------------
// Registration
// ------------------------
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;
  const role = document.getElementById("reg-role").value;

  try {
    const res = await fetch("/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, role }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("Registration successful! You can now log in.");
      registerForm.reset();
      loginForm.style.display = "block";
      registerForm.style.display = "none";
    } else {
      alert(data.message || "Registration failed");
    }
  } catch (err) {
    console.error(err);
    alert("Registration error");
  }
});

// ------------------------
// Login
// ------------------------
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (res.ok) {
      userRole = data.role;
      roleDisplay.textContent = `Hello, ${userRole}!`;
      loginForm.style.display = "none";
      registerForm.style.display = "none";
      
      userName = document.getElementById("username").value;

      if (userRole === "buyer") {
        buyerDashboard.style.display = "block";
        sellerDashboard.style.display = "none";
        loadBuyerUI();
      } else if (userRole === "seller") {
        sellerDashboard.style.display = "block";
        buyerDashboard.style.display = "none";
        loadSellerUI();
      }
    } else {
      alert(data.message || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Login error");
  }
});

// ------------------------
// Buyer UI
// ------------------------
async function loadBuyerUI() {
  try {
    const res = await fetch("/api/cars");
    carsData = await res.json();
    populateBrands();
    displayAllCars(carsData);
  } catch (err) {
    console.error("Failed to load cars:", err);
  }
}

// Populate brands for buyer
function populateBrands() {
  brandSelect.innerHTML = `<option value="">-- Choose a brand --</option>`;
  Object.keys(carsData).forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    brandSelect.appendChild(option);
  });
}

// Display cars with chat
function displayAllCars(data) {
  infoDiv.innerHTML = "";
  Object.keys(data).forEach((brand) => {
    Object.keys(data[brand]).forEach((model) => {
      const car = data[brand][model];
      console.log(car)
      const card = document.createElement("div");
      card.classList.add("car-card");
      card.innerHTML = `
        <img src="${car.image}" alt="${brand} ${model}">
        <h2>${brand} ${model}</h2>
        <p><strong>Year:</strong> ${car.year}</p>
        <p><strong>Engine:</strong> ${car.engine}</p>
        <p><strong>Horsepower:</strong> ${car.horsePower} HP</p>
        <p><strong>Gearbox:</strong> ${car.gearbox}</p>
        <p><strong>Price:</strong> €${car.price.toLocaleString()}</p>

        <div class="chat-container">
          <h3>Chat with Seller</h3>
          <div class="chat-box"></div>
          <input type="text" class="chat-input" placeholder="Type a message...">
          <button class="send-btn">Send</button>
        </div>
      `;
      infoDiv.appendChild(card);

      const chatBox = card.querySelector(".chat-box");
      const chatInput = card.querySelector(".chat-input");
      const sendBtn = card.querySelector(".send-btn");
      const chatRoom = `${brand}_${model}`;

      sendBtn.addEventListener("click", async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        await fetch("/api/message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ carId: 1, sender: userName, text: message })
            });

        socket.emit("sendMessage", { car: chatRoom, sender: userName, text: message });
        chatInput.value = "";
      });

      socket.on("receiveMessage", (msg) => {
        if (msg.car === chatRoom) {
          const msgDiv = document.createElement("div");
          msgDiv.classList.add("chat-message");
          msgDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
          chatBox.appendChild(msgDiv);
          chatBox.scrollTop = chatBox.scrollHeight;
        }
      });
    });
  });
}

// Brand filter
brandSelect.addEventListener("change", () => {
  const brand = brandSelect.value;
  modelSelect.innerHTML = '<option value="">-- Select a model --</option>';
  if (brand && carsData[brand]) {
    Object.keys(carsData[brand]).forEach((model) => {
      const option = document.createElement("option");
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });
    displayAllCars({ [brand]: carsData[brand] });
  } else {
    displayAllCars(carsData);
  }
});

// Model filter
modelSelect.addEventListener("change", () => {
  const brand = brandSelect.value;
  const model = modelSelect.value;
  if (brand && model && carsData[brand][model]) {
    displayAllCars({ [brand]: { [model]: carsData[brand][model] } });
  } else if (brand) {
    displayAllCars({ [brand]: carsData[brand] });
  } else {
    displayAllCars(carsData);
  }
});

// ------------------------
// Seller UI
// ------------------------
async function loadSellerUI() {
  const sellerMessagesDiv = document.getElementById("seller-chat-box");
  sellerMessagesDiv.innerHTML = "";

  // Fetch all messages from backend
  try {
    const res = await fetch("/api/messages");
    const messages = await res.json();

    messages.forEach(msg => {
      const carDivId = `chat-car-${msg.car_id}`;
      let carDiv = document.getElementById(carDivId);

      if (!carDiv) {
        carDiv = document.createElement("div");
        carDiv.id = carDivId;
        carDiv.classList.add("chat-container");
        carDiv.innerHTML = `<h4>${msg.brand} ${msg.model} (Car ID: ${msg.car_id})</h4><div class="chat-box"></div>`;
        sellerMessagesDiv.appendChild(carDiv);
      }

      const chatBox = carDiv.querySelector(".chat-box");
      const msgDiv = document.createElement("div");
      msgDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.message}`;
      chatBox.appendChild(msgDiv);
      chatBox.scrollTop = chatBox.scrollHeight;
    });
  } catch (err) {
    console.error("Failed to load messages:", err);
  }

  // Listen for new messages via Socket.io
  socket.on("receiveMessage", (msg) => {
    const carDivId = `chat-car-${msg.carId}`;
    let carDiv = document.getElementById(carDivId);

    if (!carDiv) {
      carDiv = document.createElement("div");
      carDiv.id = carDivId;
      carDiv.classList.add("chat-container");
      carDiv.innerHTML = `<h4>Car ID: ${msg.carId}</h4><div class="chat-box"></div>`;
      sellerMessagesDiv.appendChild(carDiv);
    }

    const chatBox = carDiv.querySelector(".chat-box");
    const msgDiv = document.createElement("div");
    msgDiv.innerHTML = `<strong>${msg.sender}:</strong> ${msg.text}`;
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}
