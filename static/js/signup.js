// static/js/signup.js

document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const messageBox = document.getElementById('messageBox');

    function showMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.className = `mt-6 p-4 rounded-lg text-sm text-center font-medium ${type}`;
        messageBox.classList.remove('hidden');
    }

    function hideMessageBox() {
        messageBox.classList.add('hidden');
        messageBox.textContent = '';
        messageBox.className = 'hidden';
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            hideMessageBox();

            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirm_password').value.trim();

            if (!username || !email || !password || !confirmPassword) {
                showMessage('Please fill in all fields.', 'error');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }

            if (password.length < 8) {
                showMessage('Password must be at least 8 characters long.', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showMessage('Passwords do not match.', 'error');
                return;
            }

            try {
                // Step 1: Register the user
                const registerResponse = await fetch('/api/v1/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, email, password })
                });

                const registerData = await registerResponse.json();

                if (registerResponse.ok) {
                    showMessage(registerData.message || 'Registration successful! Attempting to log you in...', 'success');
                    signupForm.reset(); // Clear the form

                    // Step 2: Attempt to log in the newly registered user
                    const loginResponse = await fetch('/api/v1/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email: email, password: password })
                    });

                    const loginData = await loginResponse.json();

                    if (loginResponse.ok) {
                        localStorage.setItem('authToken', loginData.access_token);
                        showMessage('Login successful! Redirecting to dashboard.', 'success');
                        console.log('Login successful. Redirecting to map dashboard...');
                        // Redirect to the new dashboard with map after successful signup and login
                        setTimeout(() => { window.location.href = '/map-dashboard'; }, 1000); // Shorter delay for smoother transition
                    } else {
                        // If auto-login fails (unlikely after successful registration),
                        // inform user to manually log in.
                        showMessage(loginData.detail || 'Registration successful, but automatic login failed. Please try logging in manually.', 'error');
                        setTimeout(() => { window.location.href = '/templates/login.html'; }, 2000);
                    }

                } else {
                    // Display specific registration error message from backend if available
                    showMessage(registerData.detail || 'Registration failed. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error during signup or login:', error);
                showMessage('An unexpected error occurred during registration or login. Please try again later.', 'error');
            }
        });
    } else {
        console.error("Signup form element not found. Check ID 'signupForm'.");
    }
});
