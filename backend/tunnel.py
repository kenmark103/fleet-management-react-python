import ngrok
import time
from core.config import get_settings

settings = get_settings()
listener = ngrok.forward(8000, authtoken=settings.NGROK_AUTHTOKEN)

print(f"Ingress established at {listener.url()}")

try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stopping listener")
