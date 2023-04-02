let codes = []

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text)
    } catch (err) {
        console.error('Could not copy text: ', err)
    }
}

function appendCode(code) {
    // add code to codes array
    codes.push(code)

    // add code button to popup
    let button = document.createElement('button')
    button.textContent = code
    document.getElementById('codes').appendChild(button)
}

// check status of background script when popup opened
chrome.runtime.sendMessage({ action: 'checkStatus' }, function(response) {
    if (chrome.runtime.lastError) {
        window.close()
        console.error(chrome.runtime.lastError.message)
        return
    }

    if (response && response.message) {
        let active = JSON.parse(response.message)

        // request and display codes
        chrome.runtime.sendMessage({ action: 'requestCodes' }, function(response) {
            if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError.message)
                return
            }

            if (response && response.message) {
                let codes = JSON.parse(response.message)

                if (codes.length === 0) {
                    window.close()
                    return
                }

                for (let i = 0; i < codes.length; i++) {
                    appendCode(codes[i])
                }

                let elements = document.getElementById('codes').children

                for (let i = 0; i < elements.length; i++) {
                    let element = elements[i]
                    element.addEventListener('click', function() {
                        // remove code from codes array (code copied, so user has 'used' code)
                        codes.splice(codes.indexOf(element.textContent.toString()), 1)

                        // copy code to clipboard
                        copyToClipboard(element.textContent).then()

                        // notify user
                        element.textContent = 'Copied!'

                        // send updated codes list to background script
                        chrome.runtime.sendMessage({ action: 'updateCodes', message: JSON.stringify(codes) })

                        // close popup (increase usability/efficiency)
                        setTimeout(function() {
                            window.close()
                        }, 1000)
                    })
                }
            } else {
                console.error('No response received from background script.')
            }
        })
    } else {
        window.close()
        console.error('No response received from background script.')
    }
})