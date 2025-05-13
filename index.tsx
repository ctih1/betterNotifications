import definePlugin, { PluginNative, OptionType } from "@utils/types";
import { sendMessage } from "@utils/discord";
import { MessageStore, showToast, Toasts } from "@webpack/common";
import { ChannelRouter } from "@webpack/common";
import { findByPropsLazy } from "@webpack";
import { MessageActions } from "@webpack/common";
import { definePluginSettings } from "@api/Settings";

let socket: WebSocket;

const settings = definePluginSettings({
    notificationTitle: {
        type: OptionType.STRING,
        description: "Notification title content",
        default: "{SENDERDISPLAYNAME} #{GROUPNAME}",
    },
    notificationBody: {
        type: OptionType.STRING,
        description: "Notification body content",
        default: "{BODY}",
    },
    notificationShowPfp: {
        type: OptionType.BOOLEAN,
        description: "Shows the sender's profile picture as an attachment in the message.",
        default: true,
    },
});


export default definePlugin({
    name: "BetterNotifications",
    description: "Improves discord's notifications",
    authors: [{ name: "ctih1", id: 642441889181728810n }],
    settings: settings,

    patches: [
        {
            find: 'Notification body contains null character, setting to empty string',
            replacement: {
                match: /async function (\i)\((\i),(\i),(\i),(\i),(\i)\){/,
                replace: `
                async function $1($2,$3,$4,$5,$6) {
                    Vencord.Plugins.plugins.BetterNotifications.NotificationHandlerHook($2, $3, $4, $5, $6); 
                    console.log("Replaced function $1 with own notification handler");
                    throw new Error("Intercepted message");
                `
            }
        },
    ],


    start() {
        let connected: boolean = false;
        let interval;

        socket = new WebSocket("ws://localhost:8660");
        socket.onerror = (error) => {
            if (!connected) {
                showToast("[BetterNotifications] Failed to connect to notification server. Retrying in 10 seconds", Toasts.Type.FAILURE, { duration: 9000 });
                setTimeout(() => this.start(), 10000);
            } else {
                showToast(`[BetterNotifications] Notification server error ${error}`, Toasts.Type.FAILURE, { duration: 30000 });
            }
        };

        socket.onopen = (event) => {
            connected = true;
            showToast("[BetterNotifications] Connected to notification server", Toasts.Type.SUCCESS, { duration: 6000 });
            clearInterval(interval);
        };

        socket.onmessage = (event) => {
            let json = JSON.parse(event.data);
            let id = json["id"];
            let messageId = json["message_id"];
            let action = json["action"];

            switch (action) {
                case "reply":
                    ChannelRouter.transitionToChannel(id);
                    sendMessage(
                        id,
                        { content: json["text"] },
                        true,
                        {
                            "messageReference": {
                                "channel_id": id,
                                "message_id": messageId
                            }
                        }
                    );
                    break;

                case "click":
                    ChannelRouter.transitionToChannel(id);
                    break;
            };

        };
    },

    NotificationHandlerHook(...args) {
        console.log("Recieved hooked notification");
        console.log(args);

        let titleFormat: string = settings.store.notificationTitle;
        let titleBody: string = settings.store.notificationBody;

        let title: string = titleFormat;
        let body: string = titleBody;
        let profileUrl: string = "";
        let attachmentUrl: string = "";

        args.forEach((arg) => {
            console.log("Iterating");
            if (arg["isUserAvatar"]) {
                let attachments = arg.messageRecord.attachments;
                if (attachments && attachments.size > 0) {
                    console.log("Found attachment url");
                    attachmentUrl = attachments[0]["url"];
                } else {
                    console.log("Couldnt find attachment");
                    console.log(arg);
                }
            } else if (arg["body"]) {
                console.log("Running replacment");
                profileUrl = arg["senderAvatar"];

                for (let [key, val] of Object.entries(arg)) {
                    console.log(`{${key.toUpperCase()}}`);
                    title = title.replaceAll(`{${key.toUpperCase()}}`, `${val}`);
                    body = body.replaceAll(`{${key.toUpperCase()}}`, `${val}`);
                }
            }
        });

        let channelId = args[4]["messageRecord"]["channel_id"];
        let jsonString = JSON.stringify({
            "title": args[1],
            "body": args[2],
            "id": channelId,
            "message_id": args[3]["message_id"],
            "guild_id": "none",
            "avatar_url": (settings.store.notificationShowPfp ? args[0] : undefined),
            "attachment_url": attachmentUrl
        });

        console.log("Sending following JSON to server");
        console.log(jsonString);

        socket.send(jsonString);


        console.log(args);
    },

    NotificationHandler(...args) {
        console.log("Intercepted notification with args");
        console.log(args);

        let titleFormat: string = settings.store.notificationTitle;
        let titleBody: string = settings.store.notificationBody;

        let title: string = titleFormat;
        let body: string = titleBody;
        let profileUrl: string = "";
        let attachmentUrl: string = "";


        console.log(args.length);

        args.forEach((arg) => {
            console.log("Iterating");
            if (!arg["body"]) {
                let attachments = arg.messageRecord.attachments;
                if (attachments) {
                    console.log("Found attachment url");
                    attachmentUrl = attachments[0]["url"];
                } else {
                    console.log("Couldnt find attachment");
                    console.log(arg);
                }
            } else {
                console.log("Running replacment");
                profileUrl = arg["senderAvatar"];

                for (let [key, val] of Object.entries(arg)) {
                    console.log(`{${key.toUpperCase()}}`);
                    title = title.replaceAll(`{${key.toUpperCase()}}`, `${val}`);
                    body = body.replaceAll(`{${key.toUpperCase()}}`, `${val}`);
                }
            }
        });

        let channelId = args[1]["messageRecord"]["channel_id"];
        let jsonString = JSON.stringify({
            "title": title,
            "body": body,
            "id": channelId,
            "message_id": args[0]["identifier"],
            "guild_id": "none",
            "avatar_url": profileUrl,
            "attachment_url": attachmentUrl
        });

        console.log("Sending following JSON to server");
        console.log(jsonString);

        socket.send(jsonString);
    }
});
