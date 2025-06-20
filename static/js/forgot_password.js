// static/js/forgot_password.js

document.addEventListener('DOMContentLoaded', () => {
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
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

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            hideMessageBox();

            const email = document.getElementById('email').value.trim();

            if (!email) {
                showMessage('Please enter your email address.', 'error');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showMessage('Please enter a valid email address.', 'error');
                return;
            }

            try {
                // Actual fetch request to your FastAPI backend's forgot-password endpoint
                const response = await fetch('/api/v1/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(data.message || 'Password reset link sent (if email is registered).', 'success');
                    forgotPasswordForm.reset();
                } else {
                    showMessage(data.detail || 'Failed to send password reset link. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error during forgot password request:', error);
                showMessage('An unexpected error occurred. Please try again later.', 'error');
            }
        });
    } else {
        console.error("Forgot password form element not found. Check ID 'forgotPasswordForm'.");
    }
});
