document.addEventListener('DOMContentLoaded', function () {
    const logContainer = this.getElementById('logs');
    const followLogsBtn = this.getElementById('followCheckmark');
    const buildStatusTxt = this.getElementById('buildStatus');

    /**
     * Get the correct path to establish a ws connection
     * @param {Location} loc 
     */
    function wsPath(loc) {
        return loc.pathname.replace(/\/$/, '') + '/ws';
    }

    /**
     * Add log line to the DOM
     * @param {string} str 
     */
    function appendLine(str, e = false) {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        logContainer.appendChild(p);
    }

    /**
     * Scroll to bottom of page if checkbox is checked
     */
    function scrollToBottom() {
        if (followLogsBtn.checked) {
            window.scrollTo(0, document.body.scrollHeight);
        }
    }

    /**
     * Establish websocket connection
     */
    function connect() {
        const loc = window.location;
        let new_uri = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        new_uri += "//" + loc.host;
        new_uri += wsPath(loc);
        var ws = new WebSocket(new_uri);

        ws.onmessage = function (message) {
            console.log('Got message: ', message);
            const buildEvent = JSON.parse(message.data);
            
            if (buildEvent.type === 'finish') {
                ws.close();
                buildStatusTxt.replaceChild(document.createTextNode(buildEvent.message), buildStatusTxt.firstChild);
            }
            else {
                appendLine(buildEvent.message, buildEvent.type === 'err');
                scrollToBottom();
            }
        }
    }

    connect();
    followLogsBtn.checked = false;
    followLogsBtn.addEventListener('change', scrollToBottom);
});