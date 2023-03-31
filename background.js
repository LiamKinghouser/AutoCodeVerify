let active = false

let authToken

let checkedMessages = []

let codes = []

chrome.action.setBadgeBackgroundColor({color: "#eed812"}).then()

chrome.identity.getAuthToken({'interactive': true}, function(token) {
    authToken = token
})

function findVerificationCode(emailBody) {
    const regex = /\b\d{6}\b/g
    return emailBody.match(regex)
}

function base64ToPlainText(text) {
    text = text.replaceAll('-','+')
    text = text.replaceAll('_','/')

    return atob(text)
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggle') {

    }
    if (request.action === 'checkStatus') {
        sendResponse({ message: active})
    }
    if (request.action === "requestCodes") {
        sendResponse({ message: JSON.stringify(codes) })
    }
    if (request.action === "updateCodes") {
        codes = JSON.parse(request.message)
        updateExtensionBadge()
    }
})

function updateExtensionBadge() {
    if (codes.length > 0) chrome.action.setBadgeText({text: codes.length.toString()}).then()
    else chrome.action.setBadgeText({text: ''}).then()
}

setInterval(function() {
    if (authToken === undefined) return

    // 10 seconds ago
    let time = Date.now() - (10 * 1000)
    console.log(time)

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

                        for (let i = 0; i < messageCodes.length; i++) {
                            codes.push(messageCodes[i])
                        }
                        updateExtensionBadge()
                    }
                })
        })
}, 1000)