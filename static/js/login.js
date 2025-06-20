// static/js/login.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const messageBox = document.getElementById('messageBox');

    // Function to display messages in the custom message box
    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.className = `mt-6 p-4 rounded-lg text-sm text-center font-medium ${type}`;
        messageBox.classList.remove('hidden'); // Make it visible
    }

    // Function to hide the message box
    function hideMessageBox() {
        messageBox.classList.add('hidden');
        messageBox.textContent = '';
        messageBox.className = 'hidden'; // Reset class for next message
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            hideMessageBox(); // Clear previous messages

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();

            // Client-side validation
            if (!email || !password) {
                showMessage('Please fill in both email and password.', 'error');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }

            try {
                // API call for login
                const response = await fetch('/api/v1/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email, password: password })
                });

                const data = await response.json();

                if (response.ok) { // Check if the HTTP status code is in the 200s
                    showMessage(data.message || 'Login successful!', 'success');
                    // Store token (e.g., in localStorage or sessionStorage)
                    localStorage.setItem('authToken', data.access_token);
                    // Redirect to the new dashboard with map
                    console.log('Login successful. Redirecting to map dashboard...');
                    window.location.href = '/map-dashboard'; // Redirect to the new map dashboard
                } else {
                    // Display specific error message from backend if available
                    showMessage(data.detail || 'Login failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error during login:', error);
                showMessage('An error occurred during login. Please try again later.', 'error');
            }
        });
    } else {
        console.error("Login form element not found. Check ID 'loginForm'.");
    }
});
