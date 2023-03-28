async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text)
        console.log('Text copied to clipboard')
    } catch (err) {
        console.error('Could not copy text: ', err)
    }
}

window.addEventListener("DOMContentLoaded", () => {
    let elements = document.getElementById('codes').children
    for (let element in elements) {
        console.log(element.)
        element.addEventListener('click', function() {
            copyToClipboard(element.textContent).then()
        })
    }
})
