let authToken

let checkedMessages = []

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
                    console.log(response)
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
                    let codes = findVerificationCode(message)
                    console.log(codes)

                    let id = response.id
                    chrome.notifications.create(id, {
                        type: 'basic',
                        iconUrl: 'images/icon.png',
                        title: 'New code received',
                        message: codes.toString().replaceAll(',', ' '),
                        priority: 2,
                        buttons: [
                            {
                                title: 'Copy'
                            },
                            {
                                title: 'Dismiss'
                            }
                        ]
                    })

                    chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
                        if (notifId === id) {
                            if (btnIdx === 0) {

                            } else if (btnIdx === 1) {
                                chrome.notifications.clear(id)
                            }
                        }
                    })
                })
        })
}, 5000)