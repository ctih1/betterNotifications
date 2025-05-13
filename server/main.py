from typing import TypedDict, Literal
import sys
import os
import asyncio
import logging
import json
import platform
import requests # ignore[import-untyped]
import pathlib

try:
    import websockets
    from websockets.asyncio.server import ServerConnection
except ImportError:
    print("Failed to import websocket server!")
    quit(2)
    
try:
    from desktop_notifier import DesktopNotifier, Urgency, Button, ReplyField, DEFAULT_SOUND, Attachment
except ImportError:
    print("Failed to import Desktop Notifier!")
    quit(3)

if platform.system() == "Darwin":
    from rubicon.objc.eventloop import EventLoopPolicy # type: ignore[import-untyped]
    asyncio.set_event_loop_policy(EventLoopPolicy())
    
logging.basicConfig(
    level=logging.DEBUG,
    format="[%(name)s] %(levelname)s: [%(filename)s:%(funcName)s] %(message)s",
    datefmt="%d/%m/%Y %H:%M:%S",
    stream=sys.stdout
)

logger = logging.getLogger("betterNotifications")
logger.info("Logger init")


notifier = DesktopNotifier(app_name="Discord")

READING_RATE = 120
def calculate_timeout(title: str, body: str) -> int:
    total_words: int = len(title.split(" ")) + len(body.split(" "))
    timeout: int = round((total_words / READING_RATE) * 60)+2
    logger.info(f"Calculated timeout {timeout}s")
    return timeout

class NotificationType(TypedDict):
    title: str
    body: str
    id: str
    message_id: str
    guild_id: str
    avatar_url: str
    attachment_url:str
    
def fetch_file(url:str, name:str) -> None:
    response = requests.get(url, allow_redirects=True)
    with open(f"{name}.png", "wb") as f:
         f.write(response.content)

async def client_handler(websocket: ServerConnection) -> None:
    logger.info("New client connected")

    async for message in websocket:
        logger.info(f"Recieved message {message!r}")
        data: NotificationType = json.loads(message)
        
        title: str = data.get("title", "Discord")
        body: str = data.get("body", "")
        response: str = ""
        channel_id: str = data.get("id", "Discord")
        message_id: str = data.get("message_id", "Discord")
        guild_id: str = data.get("guild_id", "Discord")
        avatar_url: str | None = data.get("avatar_url")    
        attachment_url: str | None = data.get("attachment_url")

        attachment = None
        
        if attachment_url:
            fetch_file(attachment_url, "attachment")
            attachment = Attachment(pathlib.Path(os.path.abspath("attachment.png")))
        elif avatar_url:
            fetch_file(avatar_url, "profile")
            attachment = Attachment(pathlib.Path(os.path.abspath("profile.png")))

        async def callback_handler(data: dict):
            await websocket.send(json.dumps(data))
            
        def sync_callback_handler(action: Literal["reply", "read", "click"], data: dict):
            data["action"] = action
            data["id"] = channel_id
            data["message_id"] = message_id
            data["guild_id"] = guild_id
            asyncio.create_task(callback_handler(data))

        
        await notifier.send(
            title = title,
            message = body,
            urgency = Urgency.Critical,
            buttons = [
                Button (
                    title="Mark as read",
                    on_pressed=lambda: sync_callback_handler("read", {"body": body})
                )
            ],
            reply_field = ReplyField(
                title = "Reply",
                button_title = "Send",
                on_replied = lambda text: sync_callback_handler("reply", {"text":text})
            ),
            on_clicked = lambda: sync_callback_handler("click", {}),
            sound = DEFAULT_SOUND,
            timeout = calculate_timeout(title, body),
            attachment = attachment
        )

        logger.info("Notification shown!")

        
async def main() -> None:
    async with websockets.serve(client_handler,"localhost", 8660):
        await asyncio.Future()
        
logging.getLogger("websockets.server").setLevel(logging.WARNING)
asyncio.run(main())