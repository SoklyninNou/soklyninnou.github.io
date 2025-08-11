function shareFunction() {
    const copyText = "https://soklyninnou.github.io/personal";

    navigator.clipboard.writeText(copyText).then(() => {
        showToast("Copied website link!");
    }).catch(err => {
        showToast("Failed to copy website link.");
        console.error(err);
    });
}

function showToast(message) {
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = "show";

    setTimeout(() => {
        toast.className = toast.className.replace("show", "");
    }, 1000); // disappears after 3 seconds
}

function inputText() {
    const text = document.getElementById("inputText").value;
}

function burgerMenu() {
    var x = document.getElementById("burger-menu");
    x.classList.toggle("show");
}

function dropDown() {
    var dropdown = document.getElementById("dropdown-content");
    var arrow = document.getElementById("arrow");
    dropdown.classList.toggle("show");
    arrow.textContent = dropdown.classList.contains("show") ? "▲" : "▼";
}

const fein = new Audio('audio/fein.mp3');
function feinPlay() {
    if (fein.paused) {
        fein.play();
    } else {
        fein.pause();
        fein.currentTime = 0;
    }
}