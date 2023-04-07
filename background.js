let active = false

let authToken

let checkedMessages = []

let codes = []

let emailListener

let timeout

// add toggle button to right-click menu of extension icon
chrome.contextMenus.create({
    id: 'toggle-listener',
    title: 'Enable Listener',
    contexts: ['browser_action'],
    enabled: false,
    onclick: function() {
        toggle()
    }
})

// add change user button to right-click menu of extension icon
chrome.contextMenus.create({
    id: 'change-user',
    title: 'Change User',
    contexts: ['browser_action'],
    onclick: function() {
        setUser()
    }
})

// alert user that no user is set
chrome.browserAction.setBadgeBackgroundColor({color: "#ec0000"})
chrome.browserAction.setBadgeText({text: '!'})

// attempt to set user
setUser()

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
        chrome.browserAction.setIcon({
            path: 'icons/icon_128.png'
        })
        startListener()
    }
    else {
        chrome.browserAction.setIcon({
            path: 'icons/icon_inactive_128.png'
        })
        clearInterval(timeout)
        clearInterval(emailListener)
    }
}

function setUser() {
    chrome.identity.getAuthToken({interactive: true}, function(token) {
        if (chrome.runtime.lastError) {
            console.log('User did not approve access.')
        } else {
            authToken = token
            chrome.contextMenus.update('toggle-listener', {
                enabled: true
            })
            chrome.browserAction.setBadgeBackgroundColor({color: "#eed812"})
            chrome.browserAction.setBadgeText({text: ''})
        }
    })
}

function findVerificationCode(emailBody) {
    const regex = /\b\d{6}\b/g
    return emailBody.match(regex)
}

function base64ToPlainText(text) {p
    text = text.replaceAll('-','+')
    text = text.replaceAll('_','/')

    return atob(text)
}

function updateExtensionBadge() {
    if (codes.length > 0) chrome.browserAction.setBadgeText({text: codes.length.toString()})
    else chrome.browserAction.setBadgeText({text: ''})
}

function startListener() {
    // stop listening for emails after 30 seconds
    timeout = setTimeout(function () {
        toggle()
    }, (30 * 1000))

    // email listener
    emailListener = setInterval(function() {
        console.log(authToken)
        if (authToken === undefined) return

        // 10 seconds ago
        let time = Date.now() - (30 * 1000)

        // get messages that fit criteria: unread, received after (10 seconds ago), in inbox
        let input = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread&after:${time}&labelIds=INBOX&access_token=${authToken}`

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
                        console.log(message)
                        if (message.includes('code')) {
                            console.log(message)

                            let messageCodes = findVerificationCode(message)
                            if (messageCodes === null || messageCodes === undefined) return

                            for (let i = 0; i < messageCodes.length; i++) {
                                codes.push(messageCodes[i])
                                console.log(messageCodes[i])
                            }
                            updateExtensionBadge()

                            toggle()
                        }
                    })
            })
    }, 1000)
}