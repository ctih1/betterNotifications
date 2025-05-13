# betterNotifications

# How to install
1. Install the Vencord dev build
2. Place the betterNotificaiton folder into Vencord/src/userplugins
3. run `pnpm build `
4. Run `pnpm inject` for the installer to show up
5. Run `install.ps1` in the Vencord/src/userplugins folder
6. Follow the setup instructions
7. Launch discord


# Examples

https://github.com/user-attachments/assets/9c6e6e86-5aef-43a2-a718-79954985827d


## Why we need an external server
Since netiher `window.Notification` nor Electron's notifications support replying, we had to use a 3rd party library.
Well why coulnd't we just use a 3rd party dependency? Well, cross platform notification libraries often use compiled binaries. For example, `node-notifier` would technically work, but it requires editing some configuration files that we just don't have access to. https://www.npmjs.com/package/node-notifier#within-electron-packaging