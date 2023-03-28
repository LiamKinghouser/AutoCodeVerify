let authToken

let checkedMessages = []

let codes = []

chrome.action.setBadgeBackgroundColor({color: "#eed812"}).then()

chrome.identity.getAuthToken({'interactive': true}, function(token) {
    authToken = token
})

function findVerificationCode(emailBody) {
    const regex = /\b\d{5,6}\b/g
    const codes = emailBody.match(regex)
    if (codes && codes.length > 0) {
        return codes
    }
    return null
}

function base64ToPlainText(text) {
    text = text.replaceAll('-','+')
    text = text.replaceAll('_','/')

    return atob(text)
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "requestCodes") {
        sendResponse({message: codes})
    }
    if (request.action === "updateCodes") {
        codes = JSON.parse(request.text)
    }
})

setInterval(function() {
    chrome.action.setBadgeText({text: codes.length.toString()}).then()
}, 500)

setInterval(function() {
    let input = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread&labelIds=INBOX&access_token=' + authToken

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
                        let codes = findVerificationCode(message)
                        console.log(codes)
                    }
                })
        })
}, 5000)