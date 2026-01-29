from pydantic import EmailStr
from core.config import get_settings
from jinja2 import Environment, FileSystemLoader
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart



env = Environment(loader=FileSystemLoader("templates"))
settings = get_settings()

def send_password_reset_email(email_to: EmailStr, token: str):
    template = env.get_template("reset_password.html")
    reset_link = f"{settings.FRONTEND_RESET_URL}?token={token}"
    html_content = template.render(reset_link=reset_link)
    subject = "Password Reset Request"
    send_email(email_to, subject, html_content )


def send_verification_email(email_to: EmailStr, token: str):
    template = env.get_template("verify_email.html")
    verify_link = f"{settings.FRONTEND_VERIFY_URL}?token={token}"
    html_content = template.render(verify_link=verify_link)
    send_email(email_to, "Verify Your Email", html_content)


def send_welcome_email(email_to: EmailStr, username: str):
    template = env.get_template("welcome_email.html")
    html_content = template.render(username=username)
    send_email(email_to, "Welcome to Our Platform!", html_content)



async def send_email( email_to: EmailStr, subject: str, html_content: str ):
    message = MIMEMultipart("alternative")
    message["From"] = settings.MAIL_FROM
    message["To"] = email_to
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))

    await aiosmtplib.send(
        message,
        hostname=settings.MAIL_SERVER,
        port=settings.MAIL_PORT,
        username=settings.MAIL_USERNAME,
        password=settings.MAIL_PASSWORD,
    )