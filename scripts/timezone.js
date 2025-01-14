window.formatTime = function (timeStr) {
    const date = new Date(timeStr);
    return date.toLocaleString();
}

document.addEventListener('DOMContentLoaded', function () {
    const elements = document.getElementsByClassName('to-local-time');
    for (let element of elements) {
        const innerText = element.innerText;
        if (element.firstChild) {
            element.replaceChild(document.createTextNode(window.formatTime(innerText)), element.firstChild);
        }
        else {
            element.appendChild(document.createTextNode('-'));
        }
    }
});