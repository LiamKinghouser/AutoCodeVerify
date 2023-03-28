async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text)
        console.log('Text copied to clipboard')
    } catch (err) {
        console.error('Could not copy text: ', err)
    }
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "requestCodes") {
        sendResponse({ message: JSON.stringify(codes) })
    }
    if (request.action === "updateCodes") {
        codes = JSON.parse(request.text)
    }
})

window.addEventListener("DOMContentLoaded", () => {
    let elements = document.getElementById('codes').children
    for (let i = 0; i < elements.length; i++) {
        let element = elements[i]
        element.addEventListener('click', function() {
            copyToClipboard(element.textContent).then()
            element.textContent = 'Copied!'
            chrome.runtime.sendMessage(
                "foo",
                function (response) {
                    console.log(response);
                }
            );
            setTimeout(function() {
                element.remove()
            }, 500)
        })
    }
})