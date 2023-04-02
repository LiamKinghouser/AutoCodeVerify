let active = false

let authToken

let checkedMessages = []

let codes = []

let emailListener

chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason === "install" || details.reason === 'update') {
        // set background color of extension icon
        chrome.action.setBadgeBackgroundColor({color: "#eed812"}).then()

        // get auth token of google user
        chrome.identity.getAuthToken({'interactive': true}, function(token) {
            authToken = token
        })

        // add toggle button to right-click menu of extension icon
        chrome.contextMenus.create({
            id: 'toggle-listener',
            title: 'Enable Listener',
            contexts: ['action']
        })

        // toggle the listener when the button is clicked
        chrome.contextMenus.onClicked.addListener(info => {
            if (info.menuItemId === 'toggle-listener') {
                toggle()
            }
        })
    }
})

// add message listeners
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'checkStatus') {
        console.log('hie')
        sendResponse({ message: JSON.stringify(active)})
    }
    if (request.action === "requestCodes") {
        sendResponse({ message: JSON.stringify(codes) })
    }
    if (request.action === "updateCodes") {
        codes = JSON.parse(request.message)
        updateExtensionBadge()
    }
})

function toggle() {
    active = !active
    chrome.contextMenus.update('toggle-listener', {
        title: (active ? 'Disable Listener' : 'Enable Listener')
    })
    if (active) {
        chrome.action.setIcon({
            path: 'icons/icon_128.png'
        })
        startListener()
    }
    else {
        chrome.action.setIcon({
            path: 'icons/icon_inactive_128.png'
        })
        clearInterval(emailListener)
    }
}

function findVerificationCode(emailBody) {
    const regex = /\b\d{6}\b/g
    return emailBody.match(regex)
}

function base64ToPlainText(text) {
    text = text.replaceAll('-','+')
    text = text.replaceAll('_','/')

    return atob(text)
}

function updateExtensionBadge() {
    if (codes.length > 0) chrome.action.setBadgeText({text: codes.length.toString()}).then()
    else chrome.action.setBadgeText({text: ''}).then()
}

function startListener() {
    // stop listening for emails after 10 seconds
    setTimeout(function () {
        clearInterval(emailListener)
        toggle()
    }, (10 * 1000))

    // email listener
    emailListener = setInterval(function() {
        if (authToken === undefined) return

        // 10 seconds ago
        let time = Date.now() - (10 * 1000)

        // get messages that fit criteria: unread, received after (10 seconds ago), in inbox
        let input = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread&after:${time}&labelIds=INBOX&access_token=${authToken}`
        console.log(input)

        fetch(input)
            .then((response) => response.json())
            .then((response) => {
                let messageID = response.messages[0].id
                if (checkedMessages.includes(messageID)) {
                    return
                }
                checkedMessages = []
                checkedMessages.push(messageID)

                fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageID}?format=full`, {
                    headers: {
                        "Authorization": `Bearer ${authToken}`
                    }
                })
                    .then((response) => response.json())
                    .then((response) => {
                        let message = ""
                        if (response.payload.parts) {
                            const parts = response.payload.parts
                            for (let i = 0; i < parts.length; i++) {
                                if (parts[i].mimeType === "text/plain") {
                                    message = parts[i].body.data
                                    message = base64ToPlainText(message)
                                    break
                                } else if (parts[i].mimeType === "text/html") {
                                    let html = parts[i].body.data
                                    html = base64ToPlainText(html)
                                    const regex = /<style([\s\S]*?)<\/style>|<[^>]+>/gi
                                    message = html.replace(regex, "")
                                    break
                                }
                            }
                        } else {
                            if (response.payload.mimeType === 'text/plain') message = base64ToPlainText(response.payload.body.data)
                            else {
                                const html = base64ToPlainText(response.payload.body.data)
                                const regex = /<style([\s\S]*?)<\/style>|<[^>]+>/gi
                                message = html.replace(regex, "")
                            }
                        }
                        if (message.includes('code')) {
                            console.log(message)

                            let messageCodes = findVerificationCode(message)
                            if (messageCodes === null || messageCodes === undefined) return

                            for (let i = 0; i < messageCodes.length; i++) {
                                codes.push(messageCodes[i])
                            }
                            updateExtensionBadge()
                        }
                    })
            })
    }, 1000)
}