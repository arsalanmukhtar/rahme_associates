// static/js/reset_password.js

document.addEventListener('DOMContentLoaded', () => {
    const resetPasswordForm = document.getElementById('resetPasswordForm');
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

    if (resetPasswordForm) {
        // Extract token from URL query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        // Optional: Show message if token is missing
        if (!token) {
            showMessage('No reset token found in URL. Please use the link from your email.', 'error');
            // Disable the form or hide it if no token is present
            resetPasswordForm.style.pointerEvents = 'none';
            resetPasswordForm.style.opacity = '0.5';
        }


        resetPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            hideMessageBox();

            const newPassword = document.getElementById('new_password').value.trim();
            const confirmNewPassword = document.getElementById('confirm_new_password').value.trim();

            if (!newPassword || !confirmNewPassword) {
                showMessage('Please fill in both password fields.', 'error');
                return;
            }

            if (newPassword.length < 8) {
                showMessage('New password must be at least 8 characters long.', 'error');
                return;
            }

            if (newPassword !== confirmNewPassword) {
                showMessage('Passwords do not match.', 'error');
                return;
            }

            if (!token) { // Double check token presence before API call
                showMessage('Missing reset token. Please use the link from your email.', 'error');
                return;
            }

            try {
                // Actual fetch request to your FastAPI backend's reset-password endpoint
                const response = await fetch('/api/v1/auth/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token: token, new_password: newPassword })
                });

                const data = await response.json();

                if (response.ok) {
                    showMessage(data.message || 'Your password has been successfully reset.', 'success');
                    resetPasswordForm.reset();
                    // Optionally redirect to login page after successful reset
                    setTimeout(() => { window.location.href = '/templates/login.html'; }, 2000);
                } else {
                    showMessage(data.detail || 'Failed to reset password. Please try again.', 'error');
                }
            } catch (error) {
                console.error('Error during password reset:', error);
                showMessage('An unexpected error occurred during password reset. Please try again later.', 'error');
            }
        });
    } else {
        console.error("Reset password form element not found. Check ID 'resetPasswordForm'.");
    }
});
