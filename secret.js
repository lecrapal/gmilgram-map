var pattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
var current = 0;

var keyHandler = function (event) {

    // If the key isn't in the pattern, or isn't the current key in the pattern, reset
    if (pattern.indexOf(event.key) < 0 || event.key !== pattern[current]) {
        current = 0;
        return;
    }

    // Update how much of the pattern is complete
    current++;

    // If complete, alert and reset
    if (pattern.length === current) {
        current = 0;
        capleutdesmyrtilles();
    }

};

// Listen for keydown events
document.addEventListener('keydown', keyHandler, false);

function capleutdesmyrtilles() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.zIndex = 900;
    canvas.style.display = 'block';

    const snowflakes = [];
    const snowflakeImage = new Image();
    snowflakeImage.src = 'myrtille.png';

    function createSnowflake() {
        return {
            x: Math.random() * canvas.width,
            y: 0,
            speed: Math.random() * 2 + 1,
            size: Math.random() * 20 + 10
        };
    }

    function moveSnowflakes() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        snowflakes.forEach((flake, index) => {
            flake.y += flake.speed;
            if (flake.y > canvas.height) {
                snowflakes[index] = createSnowflake();
            }
            ctx.drawImage(snowflakeImage, flake.x, flake.y, flake.size, flake.size);
        });

        requestAnimationFrame(moveSnowflakes);
    }

    function initSnow() {
        for (let i = 0; i < 100; i++) {
            snowflakes.push(createSnowflake());
        }
        moveSnowflakes();
    }

    snowflakeImage.onload = initSnow;

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}