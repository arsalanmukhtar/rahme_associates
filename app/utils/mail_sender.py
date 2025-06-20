# app/utils/email_sender.py

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from app.core.config import settings
from typing import List

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_TLS=settings.MAIL_TLS,
    MAIL_SSL=settings.MAIL_SSL,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
    # TEMPLATE_FOLDER='./templates' # If you want to use Jinja2 templates, not needed for simple text
)


async def send_password_reset_email(recipient_email: str, reset_link: str):
    """
    Sends a password reset email to the specified recipient.
    html_content = f"""
    """
    <html>
        <body>
            <p>Hello,</p>
            <p>You have requested to reset your password. Click on the link below to reset it:</p>
            <p><a href="{reset_link}">Reset your password</a></p>
            <p>This link is valid for {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes.</p>
            <p>If you did not request a password reset, please ignore this email.</p>
            <p>Thanks,<br>Your App Team</p>
        </body>
    </html>
    """

    message = MessageSchema(
        subject="Password Reset Request",
        recipients=[recipient_email],
        body=html_content,
        subtype="html",
    )

    fm = FastMail(conf)
    try:
        await fm.send_message(message)
        print(f"Password reset email sent to {recipient_email}")
        return True
    except Exception as e:
        print(f"Failed to send email to {recipient_email}: {e}")
        return False
