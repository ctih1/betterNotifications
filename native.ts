import { Notification, IpcMainInvokeEvent, WebContents, app } from "electron";

const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

interface NotificationData {
    channelId: string;
    messageId: string;
}

interface MessageOptions {
    attachmentUrl: string;
    attachmentType: "inline" | "hero",
}

interface HeaderOptions {
    channelId: string,
    channelName: string,
}

interface ExtraOptions {
    // properties prefixed with 'w' are windows specific
    wMessageOptions?: MessageOptions;
    wAttributeText?: string;
    wAvatarCrop?: boolean;
    wHeaderOptions?: HeaderOptions;
}

let webContents: WebContents | undefined;

// Notifications on Windows have a weird inconsistency where the <image> sometimes doens't load if loaded from https
function saveAvatarToDisk(userId: string, avatarId: string) {
    // Returns file path if avatar downloaded
    // Returns an empty string if the request fails
    let baseDir = path.join(os.tmpdir(), "vencordBetterNotifications", "avatars");

    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }

    let targetDir = path.join(baseDir, `${avatarId}.png`);

    if (fs.existsSync(targetDir)) {
        return targetDir;
    }

    console.log("Could not find profile picture in cache...");

    let url = `https://cdn.discordapp.com/avatars/${userId}/${avatarId}.png?size=256`;
    let file = fs.createWriteStream(targetDir);

    https.get(url, { timeout: 3000 }, (response) => {
        response.pipe(file);

        file.on("finish", () => {
            file.close(() => {
                return targetDir;
            });
        });

    }).on("error", (err) => {
        fs.unlink(targetDir, () => { });
        console.error(`Downloading avatar with link ${url} failed:  ${err.message}`);
        return "";
    });
}

function generateXml(
    titleString: string, bodyString: string,
    avatarId: string, userId: string,
    notificationData: NotificationData,
    extraOptions?: ExtraOptions
): string {
    let avatarUrl = saveAvatarToDisk(userId, avatarId);

    return `     
       <toast>
            ${extraOptions?.wHeaderOptions ?
            `
        <header
            id="${extraOptions.wHeaderOptions.channelId}"
            title="#${extraOptions.wHeaderOptions.channelName}"
            />
            `
            :
            ""
        }
            <visual>
                <binding template="ToastGeneric">
                <text>${titleString}</text>
                <text>${bodyString}</text>
                <image src="${avatarUrl}" ${extraOptions?.wAvatarCrop ? "hint-crop='circle'" : ""} placement="appLogoOverride"  />

                ${extraOptions?.wAttributeText ? `<text placement="attribution">${extraOptions.wAttributeText}</text>` : ""}
                </binding>
            </visual>
        </toast>`;
}


export function notify(event: IpcMainInvokeEvent,
    titleString: string, bodyString: string,
    avatarId: string, userId: string,
    notificationData: NotificationData,
    extraOptions?: ExtraOptions
) {

    console.log(`[BN] notify notificationData: ${notificationData.channelId}`);
    let xml = generateXml(titleString, bodyString, avatarId, userId, notificationData, extraOptions);
    console.log("[BN] Generated ToastXML: " + xml);

    const notification = new Notification({
        title: titleString,
        body: bodyString,

        // hasReply, replyPlaceholder, and actions only work on macOS
        hasReply: true,
        replyPlaceholder: "reply",
        actions: [{
            type: "button",
            text: "Ignore"
        }],

        // toastXml only works on Windows
        // https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/adaptive-interactive-toasts?tabs=xml
        toastXml: xml
    });

    notification.addListener("click", () => event.sender.executeJavaScript(`Vencord.Plugins.plugins.BetterNotifications.NotificationClickEvent(${notificationData.channelId})`));
    notification.on("reply", (event, arg) => {
        console.log("[BN] Recieved reply!");
    });
    notification.on("action", (event, arg) => {
        console.log("[BN] Action performed!");
    });
    notification.show();
}



// TODO future: app.on("second-instance") with deeplinks on Windows notifications to allow button actions
app.on("second-instance", (event, arg) => {
    console.log("[BN] second instance activated");
    console.log(arg);
    let params = new URL(arg[arg.length - 1]).searchParams;
    let channelId = params.get("c");
    let messageId = params.get("m");
    if (webContents) {
        webContents.executeJavaScript(`Vencord.Plugins.plugins.BetterNotifications.NotificationReplyButtonEvent("${channelId}", "${messageId}")`);
    } else {
        console.error("[BN] webContents not defined!");
    }
    event.preventDefault();
});

app.on("browser-window-created", (_, win) => {
    console.log("[BN] Browser window created!");
    webContents = win.webContents;
});