function nextInputElement(element) {
    let next = element.nextElementSibling;
    while (next) {
        if (next.tagName.toLowerCase() === 'input') {
            return next;
        }
        next = next.nextElementSibling;
    }
    return null;
}

function previousInputElement(element) {
    let prev = element.previousElementSibling;
    while (prev) {
        if (prev.tagName.toLowerCase() === 'input') {
            return prev;
        }
        prev = prev.previousElementSibling;
    }
    return null;
}

function moveToNext(current) {
    if (current.value.length === 1) {
        const next = nextInputElement(current);
        if (next && next.tagName.toLowerCase() === 'input') {
            next.focus();
        }
    }
}

function moveToPrevious(event) {
    if (event.key === 'Backspace' && event.target.value === '') {
        const previous = previousInputElement(event.target);
        if (previous && previous.tagName.toLowerCase() === 'input') {
            previous.focus();
            event.preventDefault();
        }
    }
}

document.getElementById('select-all').addEventListener('change', function () {
    document.querySelectorAll('input[name="species"]').forEach(checkbox => {
        checkbox.checked = this.checked;
    });
});

document.querySelectorAll('#latlng input[type="text"]').forEach(input => {
    input.addEventListener('keypress', function (event) {
        if (!/\d/.test(event.key) && event.key !== 'Enter') {
            event.preventDefault();
        }
    });
    input.addEventListener('keydown', function (event) {
        moveToPrevious(event);
    });
    input.addEventListener('input', function (event) {
        moveToNext(event.target);
    });
});